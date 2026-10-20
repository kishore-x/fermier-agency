import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Staff users who can own customers/enquiries. */
export async function getSalespeople() {
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("user_id, profiles(id, full_name, email, is_active)")
    .in("role", ["sales_executive", "sales_manager", "admin", "super_admin"]);
  const seen = new Map<string, { id: string; full_name: string }>();
  for (const r of data ?? []) {
    const p = r.profiles as unknown as { id: string; full_name: string; email: string; is_active: boolean } | null;
    if (p?.is_active && !seen.has(p.id)) seen.set(p.id, { id: p.id, full_name: p.full_name || p.email });
  }
  return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}
