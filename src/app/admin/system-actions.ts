"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff, STAFF_ROLES, type Role } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

export async function createStaffUser(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("super_admin");
  const email = str(fd.get("email")).toLowerCase();
  const name = str(fd.get("full_name"));
  const password = str(fd.get("password"));
  const roles = fd.getAll("roles").map(String).filter((r): r is Role => (STAFF_ROLES as string[]).includes(r));
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  if (name.length < 2) return { error: "Enter the user's name." };
  if (password.length < 10) return { error: "Temporary password must be at least 10 characters." };
  if (!roles.length) return { error: "Choose at least one role." };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) return { error: error?.message?.includes("already") ? "A user with this email already exists." : "Could not create user." };
  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name: name, discount_limit_pct: Number(str(fd.get("discount_limit_pct")) || 0) }).eq("id", data.user.id);
  const { error: rErr } = await supabase.from("user_roles").insert(roles.map((role) => ({ user_id: data.user!.id, role })));
  if (rErr) { await admin.auth.admin.deleteUser(data.user.id); return { error: friendlyError(rErr) }; }
  revalidatePath("/admin/users");
  return { ok: true, message: `User ${email} created. Share the temporary password securely.` };
}

export async function setUserRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("super_admin");
  const userId = str(fd.get("user_id"));
  const role = str(fd.get("role")) as Role;
  const on = str(fd.get("on")) === "true";
  if (![...STAFF_ROLES, "customer"].includes(role)) return { error: "Invalid role" };
  if (userId === session.userId && role === "super_admin" && !on) return { error: "You cannot remove your own Super Admin role." };
  const supabase = await createClient();
  const { error } = on ? await supabase.from("user_roles").insert({ user_id: userId, role }) : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/users");
  return { ok: true, message: on ? "Role granted" : "Role removed" };
}

export async function updateStaffProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("super_admin");
  const userId = str(fd.get("user_id"));
  const active = str(fd.get("is_active")) !== "false";
  if (userId === session.userId && !active) return { error: "You cannot deactivate yourself." };
  const limit = Number(str(fd.get("discount_limit_pct")) || 0);
  if (!(limit >= 0 && limit <= 100)) return { error: "Discount limit must be 0–100." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active, discount_limit_pct: limit }).eq("id", userId);
  if (error) return { error: friendlyError(error) };
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  await admin.from("audit_logs").insert({ actor_id: session.userId, action: "user.updated", entity_type: "user", entity_id: userId, after_data: { is_active: active, discount_limit_pct: limit } });
  revalidatePath("/admin/users");
  return { ok: true, message: "User updated" };
}

const settingsSchema = z.object({
  company_name: z.string().min(2).max(200), legal_name: z.string().max(200), address: z.string().max(500), phone: z.string().max(30),
  email: z.union([z.literal(""), z.string().email()]), whatsapp_number: z.string().regex(/^$|^\d{10,15}$/, "WhatsApp number: digits with country code, e.g. 919876543210"),
  gstin: z.string().regex(/^$|^[0-9A-Z]{15}$/, "GSTIN must be 15 characters"), default_terms: z.string().max(8000),
  quotation_validity_days: z.coerce.number().int().min(1).max(365), approval_discount_pct: z.coerce.number().min(0).max(100),
  approval_amount_threshold: z.coerce.number().min(0), invoice_stage: z.enum(["on_confirmation", "on_dispatch"]), allow_negative_stock: z.boolean(),
});

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin");
  const raw = Object.fromEntries(Object.keys(settingsSchema.shape).map((k) => [k, k === "allow_negative_stock" ? fd.get(k) === "on" : str(fd.get(k))]));
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.allow_negative_stock && !session.roles.includes("super_admin")) return { error: "Only a Super Admin can allow negative stock." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("company_settings").select("*").single();
  const row = { ...p.data, gstin: p.data.gstin || null, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("company_settings").update(row).eq("id", true);
  if (error) return { error: friendlyError(error) };
  await createAdminClient().from("audit_logs").insert({ actor_id: session.userId, action: "settings.updated", entity_type: "company_settings", entity_id: "1", before_data: before, after_data: row });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function markNotificationsRead(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff();
  const supabase = await createClient();
  const id = str(fd.get("id"));
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  if (id) q = q.eq("id", id);
  const { error } = await q;
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
