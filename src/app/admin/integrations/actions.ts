"use server";

import { revalidatePath } from "next/cache";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ZOHO_REGIONS, ZohoClient } from "@/lib/zoho/client";
import { getConnection, retryJob } from "@/lib/zoho/jobs";
import { str } from "@/lib/utils";

async function audit(action: string, after: unknown) {
  const s = await requireStaff("admin");
  await createAdminClient().from("audit_logs").insert({ actor_id: s.userId, action, entity_type: "integration", entity_id: "zoho_books", after_data: after });
}

export async function saveZohoSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const mode = str(fd.get("mode"));
  const region = str(fd.get("region"));
  const org = str(fd.get("organization_id"));
  if (!["mock", "live"].includes(mode)) return { error: "Invalid mode" };
  if (!(ZOHO_REGIONS as readonly string[]).includes(region)) return { error: "Invalid data centre" };
  if (org && !/^\d{5,20}$/.test(org)) return { error: "Organisation ID should be numeric." };
  const taxMap: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("tax_") && typeof v === "string" && v.trim()) {
      if (!/^\d{1,30}$/.test(v.trim())) return { error: `Tax ID for ${k.slice(4)}% must be numeric.` };
      taxMap[k.slice(4)] = v.trim();
    }
  }
  if (mode === "live" && !org) return { error: "Live mode requires the Zoho organisation ID." };
  const admin = createAdminClient();
  const { data: cur } = await admin.from("integration_connections").select("region, settings").eq("provider", "zoho_books").single();
  const regionChanged = cur?.region !== region;
  const { error } = await admin.from("integration_connections").update({
    mode, region, organization_id: org || null, settings: { ...(cur?.settings ?? {}), tax_map: taxMap },
    ...(regionChanged ? { is_connected: false, token_expires_at: null } : {}), updated_at: new Date().toISOString(),
  }).eq("provider", "zoho_books");
  if (error) return { error: friendlyError(error) };
  if (regionChanged) await admin.from("integration_secrets").delete().eq("provider", "zoho_books");
  await audit("integration.settings_changed", { mode, region, organization_id: org, tax_rates: Object.keys(taxMap) });
  revalidatePath("/admin/integrations");
  return { ok: true, message: regionChanged ? "Saved. Data centre changed — please re-authorise Zoho Books." : "Integration settings saved" };
}

export async function disconnectZoho(): Promise<ActionState> {
  await requireStaff("admin");
  const admin = createAdminClient();
  await admin.from("integration_secrets").delete().eq("provider", "zoho_books");
  await admin.from("integration_connections").update({ is_connected: false, mode: "mock", token_expires_at: null }).eq("provider", "zoho_books");
  await audit("integration.zoho_disconnected", {});
  revalidatePath("/admin/integrations");
  return { ok: true, message: "Disconnected. Integration switched to mock mode." };
}

export async function testZoho(): Promise<ActionState> {
  await requireStaff("admin");
  const admin = createAdminClient();
  const conn = await getConnection(admin);
  if (!conn.is_connected || !conn.organization_id) return { error: "Not connected — authorise Zoho Books and set the organisation ID first." };
  try {
    const res = await new ZohoClient(admin, conn.region, conn.organization_id).request<{ organization: { name: string } }>("GET", `/organizations/${conn.organization_id}`);
    return { ok: true, message: `Connected to Zoho Books organisation “${res.organization.name}”` };
  } catch (e) {
    return { error: `Connection test failed: ${e instanceof Error ? e.message : e}` };
  }
}

export async function retryIntegrationJob(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "sales_manager");
  const res = await retryJob(str(fd.get("job_id")));
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/invoices");
  return res.ok ? { ok: true, message: res.message } : { error: res.message };
}

export async function mapProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const productId = str(fd.get("product_id"));
  const itemId = str(fd.get("external_id"));
  const supabase = await createClient();
  if (!itemId) {
    const { error } = await createAdminClient().from("external_record_mappings").delete().eq("provider", "zoho_books").eq("entity_type", "product").eq("internal_id", productId);
    if (error) return { error: friendlyError(error) };
  } else {
    if (!/^\d{5,30}$/.test(itemId)) return { error: "Zoho item IDs are numeric (find them in the item URL in Zoho Books)." };
    const { data: p } = await supabase.from("products").select("id").eq("id", productId).single();
    if (!p) return { error: "Product not found" };
    const { error } = await createAdminClient().from("external_record_mappings").upsert(
      { provider: "zoho_books", entity_type: "product", internal_id: productId, external_id: itemId, is_mock: false }, { onConflict: "provider,entity_type,internal_id" });
    if (error) return { error: friendlyError(error) };
  }
  await audit("integration.product_mapping", { product_id: productId, item_id: itemId || null });
  revalidatePath("/admin/integrations");
  return { ok: true, message: itemId ? "Mapping saved" : "Mapping removed" };
}
