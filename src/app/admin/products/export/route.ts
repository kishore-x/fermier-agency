import { can, getSession } from "@/lib/auth";
import { CSV_COLUMNS, csvResponse, toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.isStaff) return new Response("Forbidden", { status: 403 });
  if (new URL(req.url).searchParams.get("template")) {
    return csvResponse("product-import-template.csv", toCsv([...CSV_COLUMNS], [[
      "YT-NEW-001", "Example Winch 300 kg", "lifting-equipment", "Y-tal", "YT-300", "Nos", "35000", "28000", "18", "84253100",
      "show_price", "2", "draft", "Short description", "Full description", "5",
    ]]));
  }
  const supabase = await createClient();
  const showCost = can.viewCost(session);
  const [{ data, error }, { data: costs }] = await Promise.all([
    supabase.from("products").select("id, sku, name, model_number, unit, selling_price, tax_rate, hsn_code, price_visibility, reorder_threshold, status, short_description, description, categories!products_category_id_fkey(slug), brands(name), inventory_balances(on_hand, reserved)").order("sku"),
    showCost ? supabase.from("product_costs").select("product_id, purchase_cost") : Promise.resolve({ data: [] as { product_id: string; purchase_cost: string }[] }),
  ]);
  if (error) return new Response("Export failed", { status: 500 });
  const costMap = new Map((costs ?? []).map((c) => [c.product_id, c.purchase_cost]));
  type R = (typeof data)[number] & { categories: { slug: string } | null; brands: { name: string } | null; inventory_balances: { on_hand: string; reserved: string }[] };
  const headers = ["sku", "name", "category_slug", "brand_name", "model_number", "unit", "selling_price", ...(showCost ? ["purchase_cost"] : []),
    "tax_rate", "hsn_code", "price_visibility", "reorder_threshold", "status", "short_description", "description", "on_hand", "reserved", "available"];
  const rows = (data as R[]).map((p) => {
    const onHand = p.inventory_balances.reduce((a, b) => a + Number(b.on_hand), 0);
    const reserved = p.inventory_balances.reduce((a, b) => a + Number(b.reserved), 0);
    return [p.sku, p.name, p.categories?.slug, p.brands?.name, p.model_number, p.unit, p.selling_price, ...(showCost ? [costMap.get(p.id)] : []),
      p.tax_rate, p.hsn_code, p.price_visibility, p.reorder_threshold, p.status, p.short_description, p.description, onHand, reserved, onHand - reserved];
  });
  return csvResponse(`products-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
}
