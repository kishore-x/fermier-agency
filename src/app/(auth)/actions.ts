"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit("login", 10, 60_000))) return { error: "Too many attempts. Please wait a minute and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(fd.get("email")), password: str(fd.get("password")) });
  if (error || !data.user) return { error: "Incorrect email or password." };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  const isStaff = (roles ?? []).some((r) => r.role !== "customer");
  redirect(safeNext(str(fd.get("next"))) || (isStaff ? "/admin" : "/portal"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const registerSchema = z.object({
  full_name: z.string().min(2, "Enter your name").max(120),
  company_name: z.string().min(2, "Enter your company name").max(200),
  email: z.string().email("Enter a valid email").max(200),
  phone: z.string().min(7, "Enter a phone number").max(20),
  state: z.string().max(80).optional(),
  gstin: z.string().max(15).regex(/^$|^[0-9A-Z]{15}$/, "GSTIN must be 15 characters").optional(),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export async function register(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit("register", 5, 10 * 60_000))) return { error: "Too many sign-ups from this network. Try again later." };
  const parsed = registerSchema.safeParse(Object.fromEntries(["full_name", "company_name", "email", "phone", "state", "gstin", "password"]
    .map((k) => [k, k === "gstin" ? str(fd.get(k)).toUpperCase() : str(fd.get(k))])));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email, password: v.password, email_confirm: true, user_metadata: { full_name: v.full_name },
  });
  if (error || !created.user) {
    return { error: error?.message?.includes("already") ? "An account with this email already exists. Try signing in." : "Could not create your account." };
  }
  const uid = created.user.id;
  try {
    const { data: code, error: codeErr } = await admin.rpc("next_document_number", { p_type: "customer" });
    if (codeErr) throw codeErr;
    const { data: cust, error: cErr } = await admin.from("customers").insert({
      customer_code: code, company_name: v.company_name, primary_contact: v.full_name, email: v.email, phone: v.phone,
      state: v.state || null, gstin: v.gstin || null, customer_type: "business",
    }).select("id").single();
    if (cErr) throw cErr;
    await admin.from("profiles").update({ full_name: v.full_name, phone: v.phone }).eq("id", uid);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, role: "customer" });
    if (rErr) throw rErr;
    const { error: lErr } = await admin.from("customer_users").insert({ user_id: uid, customer_id: cust.id });
    if (lErr) throw lErr;
    await admin.from("customer_activities").insert({ customer_id: cust.id, activity_type: "account", summary: "Customer registered online" });
    const { data: staff } = await admin.from("user_roles").select("user_id").in("role", ["admin", "sales_manager"]);
    if (staff?.length) {
      await admin.from("notifications").insert(staff.map((s) => ({
        user_id: s.user_id, event_type: "customer.registered", title: `New customer registration: ${v.company_name}`, link: `/admin/customers/${cust.id}`,
      })));
    }
  } catch (e) {
    console.error("[register] provisioning failed", e);
    await admin.auth.admin.deleteUser(uid);
    return { error: "Could not complete registration. Please try again." };
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  redirect("/portal?welcome=1");
}

const contactSchema = z.object({
  name: z.string().min(2).max(120), email: z.string().email().max(200), phone: z.string().max(20).optional(),
  company: z.string().max(200).optional(), message: z.string().min(5, "Tell us what you need").max(4000),
});

export async function submitContact(_: ActionState, fd: FormData): Promise<ActionState> {
  if (str(fd.get("website"))) return { ok: true, message: "Thanks — we'll be in touch." }; // honeypot
  if (!(await rateLimit("contact", 5, 10 * 60_000))) return { error: "Too many enquiries from this network. Try again later." };
  const parsed = contactSchema.safeParse({
    name: str(fd.get("name")), email: str(fd.get("email")), phone: str(fd.get("phone")) || undefined,
    company: str(fd.get("company")) || undefined, message: str(fd.get("message")),
  });
  if (!parsed.success) {
    return { error: "Please correct the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const v = parsed.data;
  const admin = createAdminClient();
  const { data: num } = await admin.rpc("next_document_number", { p_type: "enquiry" });
  const { data: enq, error } = await admin.from("enquiries").insert({
    enquiry_number: num, source: "website", contact_name: v.name, contact_email: v.email, contact_phone: v.phone,
    notes: [v.company && `Company: ${v.company}`, v.message].filter(Boolean).join("\n"),
  }).select("id").single();
  if (error) return { error: "Could not send your enquiry. Please try again or call us." };
  await admin.from("enquiry_activities").insert({ enquiry_id: enq.id, activity_type: "status_change", to_status: "new", body: "Website contact form", is_internal: false });
  const { data: staff } = await admin.from("user_roles").select("user_id").in("role", ["admin", "sales_manager"]);
  if (staff?.length) {
    await admin.from("notifications").insert(staff.map((s) => ({
      user_id: s.user_id, event_type: "enquiry.new", title: `New website enquiry ${num}`, body: v.name, link: `/admin/enquiries/${enq.id}`,
    })));
  }
  return { ok: true, message: `Thanks — your enquiry ${num} has been received. Our team will contact you shortly.` };
}
