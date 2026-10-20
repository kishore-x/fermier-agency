import type { PostgrestError } from "@supabase/supabase-js";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

/** Turn a Postgres/PostgREST error into a message safe to show users (no internals leak). */
export function friendlyError(e: PostgrestError | Error | null | undefined): string {
  if (!e) return "Something went wrong";
  const msg = e.message ?? "";
  if (msg.includes("FORBIDDEN")) return "You don't have permission to do that.";
  if (msg.startsWith("INSUFFICIENT_STOCK")) return "Not enough available stock to complete this operation.";
  if ("code" in e && e.code === "23505") {
    if (msg.includes("sku")) return "That SKU is already in use.";
    if (msg.includes("slug")) return "That URL slug is already in use.";
    if (msg.includes("po_number")) return "This customer has already submitted a PO with that number.";
    return "A record with the same unique value already exists.";
  }
  if ("code" in e && e.code === "42501") return "You don't have permission to do that.";
  if ("code" in e && (e.code === "P0001" || e.code?.startsWith("22") || e.code?.startsWith("23"))) return msg;
  console.error("[action error]", e);
  return "Something went wrong. Please try again.";
}
