"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { escapeHtml, sendEmail } from "@/lib/email";
import { renderQuotationPdf } from "@/lib/pdf/quotation";
import { createClient } from "@/lib/supabase/server";
import { registerPo } from "@/lib/po";
import { formatMoney, str } from "@/lib/utils";

const dec = (max = 12) => z.string().regex(new RegExp(`^$|^\\d{1,${max}}(\\.\\d{1,2})?$`), "Invalid number");
const lineSchema = z.object({
  product_id: z.string().uuid("Choose a product"),
  quantity: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Invalid quantity").refine((v) => Number(v) > 0, "Quantity must be > 0"),
  unit_price: dec(), discount_pct: dec(3).refine((v) => !v || Number(v) <= 100, "Discount max 100%"),
  description: z.string().max(500).optional(),
});
const headerSchema = z.object({
  customer_id: z.string().uuid("Choose a customer"), enquiry_id: z.string(),
  billing_address: z.string().max(500), delivery_address: z.string().max(500),
  expiry_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/), payment_terms: z.string().max(200), delivery_terms: z.string().max(200),
  notes: z.string().max(2000), terms_and_conditions: z.string().max(8000), shipping_charges: dec(), other_charges: dec(),
});

export async function saveQuotation(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const id = str(fd.get("id")) || null;
  const header = headerSchema.safeParse(Object.fromEntries(Object.keys(headerSchema.shape).map((k) => [k, str(fd.get(k))])));
  if (!header.success) return { error: header.error.issues[0].message };
  let lines: unknown;
  try { lines = JSON.parse(str(fd.get("items"))); } catch { return { error: "Invalid line items" }; }
  const parsed = z.array(lineSchema).min(1, "Add at least one line item").max(200).safeParse(lines);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: typeof i.path[0] === "number" ? `Line ${i.path[0] + 1}: ${i.message}` : i.message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_quotation", {
    p_id: id,
    p_header: { ...header.data, shipping_charges: header.data.shipping_charges || "0", other_charges: header.data.other_charges || "0" },
    p_items: parsed.data.map((l) => ({ ...l, unit_price: l.unit_price || null, discount_pct: l.discount_pct || "0" })),
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/quotations");
  redirect(`/admin/quotations/${data}?saved=1`);
}

const ACTIONS = ["submit", "approve", "reject_approval", "mark_sent", "accept", "reject", "expire"] as const;

export async function transitionQuotation(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const action = str(fd.get("action"));
  if (!(ACTIONS as readonly string[]).includes(action)) return { error: "Unknown action" };
  const supabase = await createClient();
  const id = str(fd.get("id"));
  const { data, error } = await supabase.rpc("transition_quotation", { p_id: id, p_action: action, p_note: str(fd.get("note")) || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/quotations/${id}`);
  revalidatePath("/admin/quotations");
  const msg: Record<string, string> = {
    submit: data === "pending_approval" ? "Sent for manager approval" : "Approved — ready to send", approve: "Quotation approved",
    reject_approval: "Returned to draft", mark_sent: "Marked as sent", accept: "Recorded as accepted", reject: "Recorded as rejected", expire: "Marked as expired",
  };
  return { ok: true, message: msg[action] };
}

/** Emails the PDF. Status moves to "sent" only after the provider accepts the message. */
export async function emailQuotation(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  const id = str(fd.get("id"));
  const to = str(fd.get("to"));
  if (!z.string().email().safeParse(to).success) return { error: "Enter a valid recipient email." };
  const supabase = await createClient();
  const pdf = await renderQuotationPdf(supabase, id);
  if (!pdf) return { error: "Quotation not found" };
  if (!["approved", "sent"].includes(pdf.quotation.status)) return { error: "Only approved quotations can be sent." };
  const message = escapeHtml(str(fd.get("message"))).replace(/\n/g, "<br/>");
  const res = await sendEmail({
    to, subject: `Quotation ${pdf.quotation.quotation_number} — Fermier Agency`,
    html: `<p>Dear ${escapeHtml(pdf.quotation.customers.primary_contact ?? "Sir/Madam")},</p>
      <p>${message || "Please find our quotation attached."}</p>
      <p><strong>${pdf.quotation.quotation_number}</strong> · ${formatMoney(pdf.quotation.grand_total)} · valid until ${pdf.quotation.expiry_date}</p>
      <p>You can also view and accept it in your customer portal.</p><p>Regards,<br/>${escapeHtml(session.fullName)}</p>`,
    attachments: [{ filename: pdf.filename, content: pdf.buffer }],
  });
  if (res.status === "not_configured") return { error: "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM, or download the PDF and share it manually." };
  if (res.status === "failed") return { error: `Email provider rejected the message: ${res.error}` };
  if (pdf.quotation.status === "approved") await supabase.rpc("transition_quotation", { p_id: id, p_action: "mark_sent", p_note: `Emailed to ${to}` });
  await supabase.from("customer_activities").insert({
    customer_id: (await supabase.from("quotations").select("customer_id").eq("id", id).single()).data!.customer_id,
    activity_type: "email", summary: `Quotation ${pdf.quotation.quotation_number} emailed to ${to} (provider id ${res.id})`, reference_type: "quotation", reference_id: id, created_by: session.userId,
  });
  revalidatePath(`/admin/quotations/${id}`);
  return { ok: true, message: `Email accepted by provider for delivery to ${to}` };
}

/** Staff-side PO upload (customers use the portal version). */
export async function uploadCustomerPo(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  return registerPo(fd);
}
