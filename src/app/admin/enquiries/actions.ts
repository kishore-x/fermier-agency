"use server";

import { revalidatePath } from "next/cache";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

const STATUSES = ["new", "assigned", "contacted", "quotation_in_preparation", "quotation_sent", "awaiting_response", "accepted", "rejected", "converted", "closed"];

export async function updateEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const id = str(fd.get("id"));
  const status = str(fd.get("status"));
  if (status && !STATUSES.includes(status)) return { error: "Invalid status" };
  const follow = str(fd.get("next_follow_up_at"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_enquiry", {
    p_id: id, p_status: status || null, p_assigned: str(fd.get("assigned_to")) || null,
    p_note: str(fd.get("note")).slice(0, 2000) || null, p_follow_up: follow ? new Date(`${follow}:00+05:30`).toISOString() : null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/enquiries/${id}`);
  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Enquiry updated" };
}

export async function logEnquiryActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  const body = str(fd.get("body"));
  if (body.length < 2) return { error: "Enter a note." };
  const type = ["call", "note", "email", "meeting", "whatsapp"].includes(str(fd.get("activity_type"))) ? str(fd.get("activity_type")) : "note";
  const supabase = await createClient();
  const id = str(fd.get("enquiry_id"));
  const { error } = await supabase.from("enquiry_activities").insert({
    enquiry_id: id, activity_type: type, body: body.slice(0, 2000), is_internal: fd.get("share") !== "on", created_by: session.userId,
  });
  if (error) return { error: friendlyError(error) };
  if (type === "call") await supabase.from("enquiries").update({ status: "contacted" }).eq("id", id).in("status", ["new", "assigned"]);
  revalidatePath(`/admin/enquiries/${id}`);
  return { ok: true, message: "Activity logged" };
}

export async function linkEnquiryCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager", "sales_executive");
  const supabase = await createClient();
  const id = str(fd.get("enquiry_id"));
  const { error } = await supabase.from("enquiries").update({ customer_id: str(fd.get("customer_id")) }).eq("id", id).is("customer_id", null);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/enquiries/${id}`);
  return { ok: true, message: "Customer linked" };
}
