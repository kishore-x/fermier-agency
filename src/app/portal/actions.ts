"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireCustomer } from "@/lib/auth";
import { registerPo } from "@/lib/po";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

const itemsSchema = z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(9999) })).min(1, "Your cart is empty").max(100);

export type SubmitResult = (NonNullable<ActionState> & { reference?: string; enquiryId?: string }) | null;

/** Creates a persistent order request. Product availability and customer identity are resolved server-side. */
export async function submitOrderRequest(_: SubmitResult, fd: FormData): Promise<SubmitResult> {
  await requireCustomer();
  if (!(await rateLimit("order-request", 10, 60 * 60_000))) return { error: "Too many requests submitted. Please try again later." };
  let items: unknown;
  try { items = JSON.parse(str(fd.get("items"))); } catch { return { error: "Invalid cart" }; }
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const address = str(fd.get("delivery_address"));
  if (address.length < 5) return { error: "Enter a delivery address." };
  const date = str(fd.get("requested_delivery_date"));
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10))) return { error: "Requested delivery date must be today or later." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_order_request", {
    p_items: parsed.data, p_delivery_address: address.slice(0, 500), p_requested_date: date || null, p_notes: str(fd.get("notes")).slice(0, 2000) || null,
  });
  if (error) return { error: friendlyError(error) };
  const row = (data as { id: string; enquiry_number: string }[])[0];
  revalidatePath("/portal", "layout");
  return { ok: true, reference: row.enquiry_number, enquiryId: row.id };
}

export async function respondToQuotation(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireCustomer();
  const supabase = await createClient();
  const id = str(fd.get("id"));
  const accept = str(fd.get("decision")) === "accept";
  const { error } = await supabase.rpc("customer_respond_quotation", { p_id: id, p_accept: accept });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/portal/quotations/${id}`);
  return { ok: true, message: accept ? "Quotation accepted. Please upload your purchase order." : "Quotation declined. Your salesperson has been notified." };
}

export async function uploadMyPo(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireCustomer();
  if (!(await rateLimit("po-upload", 20, 60 * 60_000))) return { error: "Too many uploads. Please try again later." };
  return registerPo(fd);
}

export async function updateMyProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireCustomer();
  const supabase = await createClient();
  const name = str(fd.get("full_name"));
  if (name.length < 2) return { error: "Enter your name." };
  const { error: e1 } = await supabase.from("profiles").update({ full_name: name.slice(0, 120), phone: str(fd.get("phone")).slice(0, 20) || null }).eq("id", session.userId);
  if (e1) return { error: friendlyError(e1) };
  const { error: e2 } = await supabase.rpc("update_my_company", {
    p_contact: str(fd.get("primary_contact")), p_phone: str(fd.get("company_phone")), p_billing: str(fd.get("billing_address")), p_state: str(fd.get("state")),
  });
  if (e2) return { error: friendlyError(e2) };
  revalidatePath("/portal/profile");
  return { ok: true, message: "Profile updated" };
}

export async function addMyAddress(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireCustomer();
  const line1 = str(fd.get("line1"));
  if (line1.length < 5) return { error: "Enter the address." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id: session.customerId, label: str(fd.get("label")).slice(0, 40) || "Delivery", line1: line1.slice(0, 300),
    city: str(fd.get("city")).slice(0, 80) || null, state: str(fd.get("state")).slice(0, 80) || null, postal_code: str(fd.get("postal_code")).slice(0, 10) || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/portal/profile");
  return { ok: true, message: "Address added" };
}

export async function markMyNotificationsRead(): Promise<ActionState> {
  const session = await requireCustomer();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  revalidatePath("/portal", "layout");
  return { ok: true };
}
