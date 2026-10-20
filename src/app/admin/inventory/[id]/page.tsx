import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, MetricCard, Pagination } from "@/components/ui/data";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatQty, humanize, pageRange } from "@/lib/utils";
import { MovementForm } from "../movement-form";

const refLink = (type: string | null, id: string | null) =>
  !id ? null : type === "sales_order" ? `/admin/sales-orders/${id}` : type === "dispatch" ? `/admin/dispatches?id=${id}` : null;

export default async function ProductStockPage({ params, searchParams }: PageProps<"/admin/inventory/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page), 25);
  const supabase = await createClient();
  const [{ data: s }, { data: moves, count }, { data: reservations }] = await Promise.all([
    supabase.from("inventory_overview").select("*").eq("product_id", id).maybeSingle(),
    supabase.from("inventory_movements").select("id, movement_type, quantity, on_hand_after, reserved_after, reference_type, reference_id, reference_number, notes, created_at, profiles(full_name)", { count: "exact" })
      .eq("product_id", id).order("created_at", { ascending: false }).range(from, to),
    supabase.from("stock_reservations").select("id, quantity, created_at, sales_orders(id, order_number, status)").eq("product_id", id).eq("status", "active"),
  ]);
  if (!s) notFound();
  type M = NonNullable<typeof moves>[number];
  return (
    <>
      <PageHeader back={{ href: "/admin/inventory", label: "Inventory" }} title={s.name} description={`${s.sku} · ${s.category_name ?? "Uncategorised"}`}
        actions={<LinkButton href={`/admin/products/${id}`} variant="outline">Product master</LinkButton>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="On hand" value={formatQty(s.on_hand)} />
        <MetricCard label="Reserved" value={formatQty(s.reserved)} />
        <MetricCard label="Available" value={formatQty(s.available)} tone={Number(s.available) <= Number(s.reorder_threshold) ? "warn" : "ok"} hint={`Reorder at ${formatQty(s.reorder_threshold)}`} />
        <MetricCard label="Dispatched (total)" value={formatQty(s.dispatched_total)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Movement history" />
          <DataTable rows={moves ?? []} rowKey={(m: M) => m.id} empty={<EmptyState title="No movements recorded" />}
            columns={[
              { key: "at", header: "When", cell: (m: M) => <span className="whitespace-nowrap text-xs">{formatDateTime(m.created_at)}</span> },
              { key: "type", header: "Type", cell: (m: M) => humanize(m.movement_type) },
              { key: "qty", header: "Qty", align: "right", cell: (m: M) => <span className={Number(m.quantity) < 0 ? "text-danger" : "text-ok-600"}>{Number(m.quantity) > 0 ? "+" : ""}{formatQty(m.quantity)}</span> },
              { key: "oh", header: "On hand after", align: "right", cell: (m: M) => formatQty(m.on_hand_after) },
              { key: "rs", header: "Reserved after", align: "right", cell: (m: M) => formatQty(m.reserved_after) },
              { key: "ref", header: "Reference", cell: (m: M) => { const l = refLink(m.reference_type, m.reference_id); return l ? <Link href={l} className="text-navy hover:underline">{m.reference_number}</Link> : m.reference_number ?? "—"; } },
              { key: "by", header: "By", cell: (m: M) => (m.profiles as unknown as { full_name: string } | null)?.full_name || "System" },
              { key: "notes", header: "Notes", cell: (m: M) => <span className="text-xs text-muted">{m.notes}</span> },
            ]} />
          <Pagination page={page} total={count ?? 0} pageSize={25} basePath={`/admin/inventory/${id}`} params={sp} />
        </Card>
        <div className="space-y-4">
          {can.manageInventory(session) && <Card><CardHeader title="Record movement" /><div className="p-4"><MovementForm productId={id} /></div></Card>}
          <Card>
            <CardHeader title="Active reservations" />
            <ul className="divide-y divide-line text-sm">
              {(reservations ?? []).map((r) => {
                const so = r.sales_orders as unknown as { id: string; order_number: string; status: string };
                return <li key={r.id} className="flex items-center justify-between px-4 py-2"><Link href={`/admin/sales-orders/${so.id}`} className="text-navy hover:underline">{so.order_number}</Link><StatusBadge status={so.status} /><span className="tnum">{formatQty(r.quantity)}</span></li>;
              })}
              {!reservations?.length && <li className="px-4 py-3 text-muted">No active reservations.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
