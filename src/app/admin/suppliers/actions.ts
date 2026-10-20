"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Name required").max(200), contact_person: z.string().max(120), phone: z.string().max(20),
  email: z.union([z.literal(""), z.string().email("Invalid email")]), address: z.string().max(500),
  gstin: z.string().regex(/^$|^[0-9A-Z]{15}$/, "GSTIN must be 15 characters"), payment_terms: z.string().max(80),
  notes: z.string().max(2000), status: z.enum(["active", "inactive"]),
});

export async function saveSupplier(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager");
  const p = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, k === "gstin" ? str(fd.get(k)).toUpperCase() : str(fd.get(k)) || (k === "status" ? "active" : "")])));
  if (!p.success) return { error: p.error.issues[0].message };
  const row = { ...p.data, email: p.data.email || null, gstin: p.data.gstin || null };
  const id = str(fd.get("id"));
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("suppliers").update(row).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data: code } = await createAdminClient().rpc("next_document_number", { p_type: "supplier" });
    const { error } = await supabase.from("suppliers").insert({ ...row, supplier_code: code });
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath("/admin/suppliers");
  return { ok: true, message: "Supplier saved" };
}

export async function linkSupplierProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager");
  const lead = str(fd.get("lead_time_days"));
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_products").upsert({
    supplier_id: str(fd.get("supplier_id")), product_id: str(fd.get("product_id")), supplier_sku: str(fd.get("supplier_sku")) || null,
    lead_time_days: lead ? Math.max(0, Math.min(365, parseInt(lead, 10) || 0)) : null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/suppliers");
  return { ok: true, message: "Product linked" };
}

export async function unlinkSupplierProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_products").delete().eq("supplier_id", str(fd.get("supplier_id"))).eq("product_id", str(fd.get("product_id")));
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/suppliers");
  return { ok: true, message: "Product unlinked" };
}
