import Link from "next/link";
import { Boxes } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, CardHeader, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge, stockStatus } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatQty, humanize, pageRange, searchTerm } from "@/lib/utils";
import { MovementForm } from "./movement-form";

type Row = { product_id: string; sku: string; name: string; category_name: string | null; on_hand: string; reserved: string; available: string; reorder_threshold: string; unit: string; stock_updated_at: string | null };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("inventory_overview").select("*", { count: "exact" }).neq("status", "archived");
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  if (sp.filter === "out") q = q.lte("available", 0);
  if (sp.filter === "reserved") q = q.gt("reserved", 0);
  // "low" compares two columns, which PostgREST can't filter; fetch the active set and filter here.
  const low = sp.filter === "low";
  const query = low ? q.order("available") : q.order("name").range(from, to);
  const [{ data, count }, { data: movements }, { data: products }] = await Promise.all([
    query,
    supabase.from("inventory_movements").select("id, movement_type, quantity, reference_number, created_at, notes, products(name, sku), profiles(full_name)").order("created_at", { ascending: false }).limit(10),
    can.manageInventory(session) ? supabase.from("products").select("id, sku, name").neq("status", "archived").order("name") : Promise.resolve({ data: [] }),
  ]);
  let rows = (data ?? []) as Row[];
  let total = count ?? 0;
  if (low) {
    rows = rows.filter((r) => Number(r.available) <= Number(r.reorder_threshold));
    total = rows.length;
    rows = rows.slice(from, to + 1);
  }

  return (
    <>
      <PageHeader title="Inventory" description="Available = on hand − active reservations. Quantities change only through recorded movements." />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <FilterBar action="/admin/inventory" resetHref="/admin/inventory">
            <Input name="q" defaultValue={sp.q} placeholder="Search product or SKU" className="w-64" />
            <Select name="filter" defaultValue={sp.filter ?? ""} className="w-48">
              <option value="">All products</option><option value="low">At or below reorder level</option>
              <option value="out">Out of stock</option><option value="reserved">With reservations</option>
            </Select>
          </FilterBar>
          <DataTable rows={rows} rowKey={(r) => r.product_id} rowHref={(r) => `/admin/inventory/${r.product_id}`}
            empty={<EmptyState icon={<Boxes className="h-10 w-10" />} title="No products match" />}
            columns={[
              { key: "name", header: "Product", cell: (r) => r.name },
              { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
              { key: "onhand", header: "On hand", align: "right", cell: (r) => formatQty(r.on_hand) },
              { key: "res", header: "Reserved", align: "right", cell: (r) => formatQty(r.reserved) },
              { key: "avail", header: "Available", align: "right", cell: (r) => <strong>{formatQty(r.available)}</strong> },
              { key: "reorder", header: "Reorder at", align: "right", cell: (r) => formatQty(r.reorder_threshold) },
              { key: "state", header: "Status", cell: (r) => <StatusBadge status={stockStatus(Number(r.available), Number(r.reorder_threshold))} /> },
              { key: "upd", header: "Last movement", cell: (r) => <span className="text-xs text-muted">{formatDateTime(r.stock_updated_at)}</span> },
            ]} />
          <Pagination page={page} total={total} pageSize={20} basePath="/admin/inventory" params={sp} />
        </Card>
        <div className="space-y-4">
          {can.manageInventory(session) && (
            <Card>
              <CardHeader title="Record stock movement" />
              <div className="p-4"><MovementForm products={(products ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` }))} /></div>
            </Card>
          )}
          <Card>
            <CardHeader title="Latest movements" />
            <ul className="divide-y divide-line text-sm">
              {(movements ?? []).map((m) => {
                const prod = m.products as unknown as { name: string; sku: string } | null;
                return (
                  <li key={m.id} className="px-4 py-2">
                    <div className="flex justify-between gap-2"><span className="truncate">{prod?.name}</span>
                      <span className={Number(m.quantity) < 0 ? "text-danger tnum" : "text-brand-600 tnum"}>{Number(m.quantity) > 0 ? "+" : ""}{formatQty(m.quantity)}</span></div>
                    <p className="text-xs text-muted">{humanize(m.movement_type)} · {m.reference_number ?? "—"} · {formatDateTime(m.created_at)}</p>
                  </li>
                );
              })}
              {!movements?.length && <li className="px-4 py-4 text-muted">No movements yet.</li>}
            </ul>
            <Link href="/admin/reports?tab=movements" className="block border-t border-line px-4 py-2 text-xs text-navy hover:underline">Full movement report</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
