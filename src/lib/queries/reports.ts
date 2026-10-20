import "server-only";
import { createClient } from "@/lib/supabase/server";

export const REPORT_TABS = [
  ["sales", "Sales"], ["quotations", "Quotations"], ["pending", "Pending orders"], ["inventory", "Inventory valuation"],
  ["low", "Low stock"], ["movements", "Stock movements"], ["invoices", "Invoices"],
] as const;
export type ReportTab = (typeof REPORT_TABS)[number][0];

export function dateRange(sp: { from?: string; to?: string }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const to = valid(sp.to) ?? iso(new Date());
  const from = valid(sp.from) ?? iso(new Date(Date.now() - 180 * 86400_000));
  return { from, to };
}

export type ReportTable = { headers: string[]; rows: (string | number | null)[][]; numeric: number[]; note?: string; summary?: [string, string][] };

/** Every report goes through RLS / role-checked SQL functions with the caller's session. */
export async function runReport(tab: ReportTab, from: string, to: string, dim = "period"): Promise<ReportTable> {
  const supabase = await createClient();
  switch (tab) {
    case "sales": {
      const { data, error } = await supabase.rpc("report_sales", { p_from: from, p_to: to, p_dim: dim });
      if (error) throw error;
      const rows = (data ?? []) as { label: string; orders: number; quantity: string | null; revenue: string }[];
      return { headers: [dim === "period" ? "Month" : dim[0].toUpperCase() + dim.slice(1), "Orders", ...(dim === "product" || dim === "category" ? ["Quantity"] : []), "Order value (incl. GST)"],
        rows: rows.map((r) => [r.label, r.orders, ...(dim === "product" || dim === "category" ? [r.quantity] : []), r.revenue]),
        numeric: dim === "product" || dim === "category" ? [1, 2, 3] : [1, 2],
        summary: [["Orders", String(rows.reduce((a, r) => a + Number(r.orders), 0))], ["Order value", rows.reduce((a, r) => a + Number(r.revenue), 0).toFixed(2)]],
        note: "Based on confirmed sales orders (excludes cancelled). Line values for product/category are line totals incl. GST." };
    }
    case "quotations": {
      const { data, error } = await supabase.rpc("report_quotations", { p_from: from, p_to: to });
      if (error) throw error;
      const r = (data as { sent: number; accepted: number; rejected: number; converted: number; expired: number; sent_value: string; won_value: string }[])[0];
      const won = Number(r.accepted) + Number(r.converted);
      const rate = Number(r.sent) ? ((won / Number(r.sent)) * 100).toFixed(1) + "%" : "—";
      return { headers: ["Metric", "Value"], numeric: [1], rows: [["Quotations sent", r.sent], ["Accepted (open)", r.accepted], ["Converted to orders", r.converted], ["Rejected", r.rejected], ["Expired", r.expired], ["Value sent", r.sent_value], ["Value won", r.won_value], ["Conversion rate (won ÷ sent)", rate]] };
    }
    case "pending": {
      const { data } = await supabase.from("sales_orders").select("order_number, status, grand_total, order_date, requested_delivery_date, customers(company_name)")
        .in("status", ["confirmed", "stock_reserved", "partially_fulfilled", "ready_for_dispatch"]).order("order_date");
      const rows = (data ?? []).map((o) => [o.order_number, (o.customers as unknown as { company_name: string }).company_name, o.status, o.order_date, o.requested_delivery_date, o.grand_total]);
      return { headers: ["Order", "Customer", "Status", "Ordered", "Requested by", "Value"], rows, numeric: [5],
        summary: [["Orders awaiting dispatch", String(rows.length)], ["Pending value", rows.reduce((a, r) => a + Number(r[5]), 0).toFixed(2)]] };
    }
    case "inventory": {
      const { data, error } = await supabase.rpc("report_inventory_valuation");
      if (error) throw error;
      const rows = (data ?? []) as { sku: string; name: string; category: string | null; on_hand: string; unit_cost: string | null; value: string | null }[];
      const missing = rows.filter((r) => Number(r.on_hand) > 0 && r.unit_cost === null).length;
      return { headers: ["SKU", "Product", "Category", "On hand", "Unit cost", "Value at cost"], numeric: [3, 4, 5],
        rows: rows.map((r) => [r.sku, r.name, r.category, r.on_hand, r.unit_cost, r.value]),
        summary: [["Total value at cost", rows.reduce((a, r) => a + Number(r.value ?? 0), 0).toFixed(2)]],
        note: missing ? `${missing} product(s) with stock have no purchase cost and are excluded from the total.` : undefined };
    }
    case "low": {
      const { data } = await supabase.from("inventory_overview").select("sku, name, category_name, on_hand, reserved, available, reorder_threshold").eq("status", "active").order("available");
      const rows = (data ?? []).filter((r) => Number(r.available) <= Number(r.reorder_threshold));
      return { headers: ["SKU", "Product", "Category", "On hand", "Reserved", "Available", "Reorder at"], numeric: [3, 4, 5, 6],
        rows: rows.map((r) => [r.sku, r.name, r.category_name, r.on_hand, r.reserved, r.available, r.reorder_threshold]) };
    }
    case "movements": {
      const { data } = await supabase.from("inventory_movements").select("created_at, movement_type, quantity, on_hand_after, reference_number, notes, products(sku, name), profiles(full_name)")
        .gte("created_at", `${from}T00:00:00+05:30`).lte("created_at", `${to}T23:59:59+05:30`).order("created_at", { ascending: false }).limit(2000);
      return { headers: ["When", "SKU", "Product", "Type", "Qty", "On hand after", "Reference", "By", "Notes"], numeric: [4, 5],
        rows: (data ?? []).map((m) => { const p = m.products as unknown as { sku: string; name: string }; return [m.created_at, p.sku, p.name, m.movement_type, m.quantity, m.on_hand_after, m.reference_number, (m.profiles as unknown as { full_name: string } | null)?.full_name ?? "System", m.notes]; }),
        note: (data?.length ?? 0) >= 2000 ? "Showing the latest 2,000 movements — narrow the date range." : undefined };
    }
    case "invoices": {
      const { data } = await supabase.from("invoices").select("external_invoice_number, is_mock, sync_status, external_status, total, balance_due, due_date, last_synced_at, customers(company_name), sales_orders(order_number)").order("due_date");
      const today = new Date().toISOString().slice(0, 10);
      const rows = (data ?? []).map((i) => {
        const synced = i.sync_status === "created" || i.is_mock;
        const payment = !synced ? "Unsynchronised" : Number(i.balance_due) <= 0 ? "Paid" : i.due_date && i.due_date < today ? "Overdue" : "Pending payment";
        return [i.external_invoice_number ?? "—", i.is_mock ? "Simulated" : i.sync_status, (i.sales_orders as unknown as { order_number: string }).order_number,
          (i.customers as unknown as { company_name: string }).company_name, i.total, synced ? i.balance_due : null, i.due_date, payment];
      });
      return { headers: ["Invoice", "Source", "Order", "Customer", "Total", "Balance", "Due", "Payment status"], numeric: [4, 5], rows,
        note: "Payment status comes from Zoho Books. Invoices that have not been synchronised are labelled as such — never treated as paid or zero." };
    }
  }
}
