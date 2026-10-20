"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { can, requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

const schema = z.object({
  company_name: z.string().min(2, "Company name required").max(200),
  customer_type: z.enum(["business", "contractor", "dealer", "retail", "government", "individual"]),
  primary_contact: z.string().max(120), email: z.union([z.literal(""), z.string().email("Invalid email")]),
  phone: z.string().max(20), gstin: z.string().regex(/^$|^[0-9A-Z]{15}$/, "GSTIN must be 15 characters"),
  billing_address: z.string().max(500), state: z.string().max(80), country: z.string().max(80),
  payment_terms: z.string().max(80), credit_limit: z.string().regex(/^$|^\d{1,12}(\.\d{1,2})?$/, "Invalid amount"),
  salesperson_id: z.string(), status: z.enum(["active", "inactive", "on_hold"]), internal_notes: z.string().max(4000),
});

export async function saveCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, k === "gstin" ? str(fd.get(k)).toUpperCase() : str(fd.get(k))]));
  const p = schema.safeParse(raw);
  if (!p.success) return { error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const row = { ...p.data, credit_limit: p.data.credit_limit || null, salesperson_id: p.data.salesperson_id || null, gstin: p.data.gstin || null, email: p.data.email || null };
  // Only managers can reassign salesperson or change credit terms.
  if (!can.approve(session)) {
    delete (row as Partial<typeof row>).credit_limit;
    if (id) delete (row as Partial<typeof row>).salesperson_id; else row.salesperson_id = session.userId;
  }
  if (id) {
    const { error } = await supabase.from("customers").update(row).eq("id", id);
    if (error) return { error: friendlyError(error) };
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, message: "Customer saved" };
  }
  const admin = createAdminClient();
  const { data: code, error: cErr } = await admin.rpc("next_document_number", { p_type: "customer" });
  if (cErr) return { error: friendlyError(cErr) };
  const { data, error } = await supabase.from("customers").insert({ ...row, customer_code: code }).select("id").single();
  if (error) return { error: friendlyError(error) };
  await supabase.from("customer_activities").insert({ customer_id: data.id, activity_type: "account", summary: "Customer created", created_by: session.userId });
  redirect(`/admin/customers/${data.id}`);
}

export async function addAddress(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const line1 = str(fd.get("line1"));
  if (line1.length < 3) return { error: "Enter the address." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id: str(fd.get("customer_id")), label: str(fd.get("label")) || "Delivery", line1, city: str(fd.get("city")) || null,
    state: str(fd.get("state")) || null, postal_code: str(fd.get("postal_code")) || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/customers/${str(fd.get("customer_id"))}`);
  return { ok: true, message: "Address added" };
}

export async function addCustomerNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff();
  const summary = str(fd.get("summary"));
  if (summary.length < 2) return { error: "Enter a note." };
  const type = ["call", "meeting", "email", "note", "visit"].includes(str(fd.get("activity_type"))) ? str(fd.get("activity_type")) : "note";
  const supabase = await createClient();
  const { error } = await supabase.from("customer_activities").insert({
    customer_id: str(fd.get("customer_id")), activity_type: type, summary: summary.slice(0, 2000), created_by: session.userId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/customers/${str(fd.get("customer_id"))}`);
  return { ok: true, message: "Logged" };
}

/** Create a portal login for a customer contact. Staff set a temporary password and share it out-of-band. */
export async function createPortalUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin", "sales_manager");
  const email = str(fd.get("email")).toLowerCase();
  const name = str(fd.get("full_name"));
  const password = str(fd.get("password"));
  const customerId = str(fd.get("customer_id"));
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };
  const supabase = await createClient();
  const { data: cust } = await supabase.from("customers").select("id, company_name").eq("id", customerId).single();
  if (!cust) return { error: "Customer not found" };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) return { error: error?.message?.includes("already") ? "A user with this email already exists." : "Could not create the login." };
  const uid = data.user.id;
  const r1 = await admin.from("user_roles").insert({ user_id: uid, role: "customer" });
  const r2 = await admin.from("customer_users").insert({ user_id: uid, customer_id: customerId });
  if (r1.error || r2.error) {
    await admin.auth.admin.deleteUser(uid);
    return { error: "Could not link the login to this customer." };
  }
  await admin.from("profiles").update({ full_name: name }).eq("id", uid);
  await admin.from("customer_activities").insert({ customer_id: customerId, activity_type: "account", summary: `Portal login created for ${email}`, created_by: session.userId });
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true, message: `Login created for ${email}. Share the temporary password securely.` };
}
