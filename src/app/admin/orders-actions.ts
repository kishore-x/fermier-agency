"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { enqueueInvoice } from "@/lib/zoho/jobs";
import { str } from "@/lib/utils";

export async function verifyPo(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_customer_po", { p_po: id, p_notes: str(fd.get("note")).slice(0, 1000) || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath("/admin/purchase-orders");
  const issues = data as string[];
  return issues.length
    ? { ok: true, message: `Marked as requiring correction: ${issues.join("; ")}` }
    : { ok: true, message: "PO verified against the accepted quotation" };
}

export async function confirmSalesOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quotation_to_order", { p_quotation: str(fd.get("quotation_id")), p_po: str(fd.get("po_id")) });
  if (error) return { error: friendlyError(error) };
  const { data: settings } = await supabase.from("company_settings").select("invoice_stage").single();
  if (settings?.invoice_stage === "on_confirmation") await enqueueInvoice(data as string);
  revalidatePath("/admin", "layout");
  redirect(`/admin/sales-orders/${data}?confirmed=1`);
}

export async function reserveStock(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "inventory_manager");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_order_stock", { p_order: id });
  if (error) {
    if (error.message.startsWith("INSUFFICIENT_STOCK")) {
      await notifyShortage(id);
      return { error: "Not enough available stock to reserve every line. Inventory has been notified; record goods received, then try again." };
    }
    return { error: friendlyError(error) };
  }
  revalidatePath(`/admin/sales-orders/${id}`);
  return { ok: true, message: "Stock reserved for all lines" };
}

async function notifyShortage(orderId: string) {
  const supabase = await createClient();
  const { data: so } = await supabase.from("sales_orders").select("order_number").eq("id", orderId).single();
  const { data: users } = await supabase.from("user_roles").select("user_id").in("role", ["inventory_manager", "admin"]);
  if (so && users?.length) {
    await supabase.rpc("notify_users", {
      p_users: users.map((u) => u.user_id), p_event: "stock.shortage", p_title: `Stock shortage for ${so.order_number}`, p_link: `/admin/sales-orders/${orderId}`,
    });
  }
}

export async function dispatchOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager");
  const id = str(fd.get("id"));
  const lines = [...fd.entries()].filter(([k]) => k.startsWith("qty_")).map(([k, v]) => ({ item_id: k.slice(4), quantity: Number(v) || 0 })).filter((l) => l.quantity > 0);
  if (!lines.length) return { error: "Enter at least one quantity to dispatch." };
  if (lines.some((l) => !Number.isFinite(l.quantity) || l.quantity < 0 || Math.round(l.quantity * 100) !== l.quantity * 100)) return { error: "Invalid quantity." };
  const supabase = await createClient();
  let docPath: string | null = null;
  const file = fd.get("document");
  if (file instanceof File && file.size) {
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) return { error: "Delivery document must be PDF or image." };
    if (file.size > 10 * 1024 * 1024) return { error: "Delivery document must be under 10 MB." };
    const { data: so } = await supabase.from("sales_orders").select("customer_id").eq("id", id).single();
    docPath = `${so!.customer_id}/dispatch/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-60)}`;
    const { error: upErr } = await supabase.storage.from("customer-documents").upload(docPath, file, { contentType: file.type });
    if (upErr) return { error: `Upload failed: ${upErr.message}` };
  }
  const date = str(fd.get("dispatch_date"));
  const { error } = await supabase.rpc("dispatch_order", {
    p_order: id, p_lines: lines, p_method: str(fd.get("delivery_method")).slice(0, 80) || null,
    p_tracking: str(fd.get("tracking_reference")).slice(0, 120) || null, p_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, p_doc_path: docPath,
  });
  if (error) return { error: friendlyError(error) };
  const { data: settings } = await supabase.from("company_settings").select("invoice_stage").single();
  if (settings?.invoice_stage === "on_dispatch") await enqueueInvoice(id);
  revalidatePath(`/admin/sales-orders/${id}`);
  revalidatePath("/admin/dispatches");
  return { ok: true, message: "Dispatch recorded and stock updated" };
}

export async function confirmDelivery(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager", "sales_manager");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery", { p_dispatch: str(fd.get("dispatch_id")), p_notes: str(fd.get("note")).slice(0, 1000) || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Delivery confirmed" };
}

export async function cancelOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sales_order", { p_order: id, p_reason: str(fd.get("note")) });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/sales-orders/${id}`);
  return { ok: true, message: "Order cancelled and reservations released" };
}

export async function completeOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_sales_order", { p_order: id });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/sales-orders/${id}`);
  return { ok: true, message: "Order marked completed" };
}

export async function createInvoiceNow(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const id = str(fd.get("id"));
  const res = await enqueueInvoice(id, { processNow: true });
  revalidatePath(`/admin/sales-orders/${id}`);
  revalidatePath("/admin/invoices");
  return res.ok ? { ok: true, message: res.message } : { error: res.message };
}

export async function linkPoToQuotation(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_po_to_quotation", { p_po: id, p_quotation: str(fd.get("quotation_id")) });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath("/admin/purchase-orders");
  return { ok: true, message: "PO linked to the accepted quotation — you can verify it now" };
}
