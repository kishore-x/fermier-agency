import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductOpt } from "./quotation-editor";

export async function loadEditorData(userId: string) {
  const supabase = await createClient();
  const [{ data: products }, { data: customers }, { data: settings }, { data: me }] = await Promise.all([
    supabase.from("inventory_overview").select("product_id, sku, name, selling_price, unit, available, status").in("status", ["active", "inactive"]).order("name"),
    supabase.from("customers").select("id, company_name, billing_address, payment_terms").neq("status", "inactive").order("company_name").limit(1000),
    supabase.from("company_settings").select("approval_discount_pct, approval_amount_threshold, default_terms").single(),
    supabase.from("profiles").select("discount_limit_pct").eq("id", userId).single(),
  ]);
  const { data: taxes } = await supabase.from("products").select("id, tax_rate").in("id", (products ?? []).map((p) => p.product_id));
  const tax = new Map((taxes ?? []).map((t) => [t.id, t.tax_rate]));
  return {
    products: (products ?? []).map<ProductOpt>((p) => ({ id: p.product_id, sku: p.sku, name: p.name, selling_price: p.selling_price === null ? null : String(p.selling_price), unit: p.unit, available: Number(p.available), tax_rate: String(tax.get(p.product_id) ?? "18") })),
    customers: customers ?? [],
    approvalPct: Number(settings?.approval_discount_pct ?? 10),
    approvalAmount: Number(settings?.approval_amount_threshold ?? 500000),
    defaultTerms: settings?.default_terms ?? "",
    myLimit: Number(me?.discount_limit_pct ?? 0),
  };
}
