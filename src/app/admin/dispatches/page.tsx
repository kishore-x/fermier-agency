import Link from "next/link";
import { Truck } from "lucide-react";
import { DataTable, Pagination } from "@/components/ui/data";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, pageRange } from "@/lib/utils";

export default async function DispatchesPage({ searchParams }: PageProps<"/admin/dispatches">) {
  await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  const [{ data: ready }, { data: recent, count }] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number, status, grand_total, requested_delivery_date, customers(company_name), sales_order_items(quantity, dispatched_quantity)")
      .in("status", ["confirmed", "stock_reserved", "partially_fulfilled", "ready_for_dispatch"]).order("requested_delivery_date", { ascending: true, nullsFirst: false }),
    supabase.from("dispatches").select("id, dispatch_number, dispatch_date, delivery_method, tracking_reference, delivered_at, sales_orders(id, order_number, customers(company_name))", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, to),
  ]);
  type Ready = NonNullable<typeof ready>[number];
  type D = NonNullable<typeof recent>[number];
  return (
    <>
      <PageHeader title="Dispatch & fulfilment" description="Orders must have stock reserved before they can be dispatched." />
      <Card className="mb-4">
        <CardHeader title={`Orders awaiting dispatch (${ready?.length ?? 0})`} />
        <DataTable rows={ready ?? []} rowKey={(r: Ready) => r.id}
          empty={<EmptyState icon={<Truck className="h-10 w-10" />} title="Nothing waiting" description="Confirmed orders appear here." />}
          columns={[
            { key: "num", header: "Order", cell: (r: Ready) => <Link href={`/admin/sales-orders/${r.id}`} className="font-medium text-navy hover:underline">{r.order_number}</Link> },
            { key: "cust", header: "Customer", cell: (r: Ready) => (r.customers as unknown as { company_name: string }).company_name },
            { key: "status", header: "Status", cell: (r: Ready) => <StatusBadge status={r.status} /> },
            { key: "prog", header: "Units dispatched", align: "right", cell: (r: Ready) => { const it = r.sales_order_items as { quantity: string; dispatched_quantity: string }[];
              return `${it.reduce((a, x) => a + Number(x.dispatched_quantity), 0)} / ${it.reduce((a, x) => a + Number(x.quantity), 0)}`; } },
            { key: "val", header: "Value", align: "right", cell: (r: Ready) => formatMoney(r.grand_total) },
            { key: "req", header: "Requested by", cell: (r: Ready) => formatDate(r.requested_delivery_date) },
            { key: "act", header: "", align: "right", cell: (r: Ready) => <LinkButton href={`/admin/sales-orders/${r.id}`} size="sm" variant={r.status === "confirmed" ? "outline" : "success"}>{r.status === "confirmed" ? "Reserve stock" : "Dispatch"}</LinkButton> },
          ]} />
      </Card>
      <Card>
        <CardHeader title="Dispatch history" />
        <DataTable rows={recent ?? []} rowKey={(r: D) => r.id} empty={<EmptyState title="No dispatches yet" />}
          columns={[
            { key: "num", header: "Dispatch", cell: (r: D) => r.dispatch_number },
            { key: "so", header: "Order", cell: (r: D) => { const so = r.sales_orders as unknown as { id: string; order_number: string }; return <Link href={`/admin/sales-orders/${so.id}`} className="text-navy hover:underline">{so.order_number}</Link>; } },
            { key: "cust", header: "Customer", cell: (r: D) => (r.sales_orders as unknown as { customers: { company_name: string } }).customers.company_name },
            { key: "date", header: "Date", cell: (r: D) => formatDate(r.dispatch_date) },
            { key: "via", header: "Method / tracking", cell: (r: D) => [r.delivery_method, r.tracking_reference].filter(Boolean).join(" · ") || "—" },
            { key: "del", header: "Delivery", cell: (r: D) => r.delivered_at ? <StatusBadge status="delivered" label={`Delivered ${formatDate(r.delivered_at)}`} /> : <StatusBadge status="dispatched" label="In transit" /> },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/dispatches" params={sp} />
      </Card>
    </>
  );
}
