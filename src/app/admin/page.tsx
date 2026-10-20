import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MetricCard, Timeline } from "@/components/ui/data";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatQty, humanize } from "@/lib/utils";

type Metrics = {
  active_products: number; customers: number; stock_value: string | null; stock_value_missing_cost: number | null;
  low_stock: number; new_enquiries: number; quotations_awaiting: number; quotations_pending_approval: number;
  confirmed_orders: number; awaiting_dispatch: number; invoices_pending: number; invoices_unpaid: number; invoices_overdue: number;
  integration_failures: number; pending_order_value: string; quotation_pipeline: Record<string, number>;
  order_status: Record<string, number>; sales_by_month: { month: string; total: string; orders: number }[];
};

export default async function Overview({ searchParams }: PageProps<"/admin">) {
  const session = await requireStaff();
  const { denied } = (await searchParams) as { denied?: string };
  const supabase = await createClient();
  const [{ data: m, error }, { data: enquiries }, { data: orders }, { data: lowStock }, { data: failures }] = await Promise.all([
    supabase.rpc("dashboard_metrics"),
    supabase.from("enquiries").select("id, enquiry_number, status, created_at, contact_name, customers(company_name)").order("created_at", { ascending: false }).limit(6),
    supabase.from("sales_orders").select("id, order_number, status, grand_total, updated_at, customers(company_name)").order("updated_at", { ascending: false }).limit(6),
    supabase.from("inventory_overview").select("product_id, sku, name, available, reorder_threshold").eq("status", "active").order("available").limit(50),
    supabase.from("integration_jobs").select("id, job_type, last_error, updated_at, attempts").eq("status", "failed").order("updated_at", { ascending: false }).limit(5),
  ]);
  if (error || !m) return <Alert tone="error">Could not load dashboard metrics. {error?.message}</Alert>;
  const k = m as Metrics;
  const low = (lowStock ?? []).filter((r) => Number(r.available) <= Number(r.reorder_threshold)).slice(0, 8);
  const maxMonth = Math.max(1, ...k.sales_by_month.map((x) => Number(x.total)));
  const pipelineOrder = ["draft", "pending_approval", "approved", "sent", "accepted", "converted", "rejected", "expired"];
  const pipeTotal = Object.values(k.quotation_pipeline).reduce((a, b) => a + b, 0) || 1;
  const orderTotal = Object.values(k.order_status).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <PageHeader title={`Good day, ${session.fullName.split(" ")[0]}`} description="Live operational summary across catalog, sales and fulfilment." />
      {denied && <Alert tone="warn" className="mb-4">You don&apos;t have access to that page. Ask a Super Admin to update your role.</Alert>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Active products" value={k.active_products} href="/admin/products?status=active" />
        <MetricCard label="Active customers" value={k.customers} href="/admin/customers" />
        {k.stock_value !== null && (
          <MetricCard label="Stock value (at cost)" value={formatMoney(k.stock_value)}
            hint={k.stock_value_missing_cost ? `${k.stock_value_missing_cost} item(s) have no cost recorded` : "Based on recorded purchase cost"} href="/admin/reports?tab=inventory" />
        )}
        <MetricCard label="Low-stock products" value={k.low_stock} tone={k.low_stock ? "warn" : undefined} href="/admin/inventory?filter=low" />
        <MetricCard label="New enquiries" value={k.new_enquiries} tone={k.new_enquiries ? "ok" : undefined} href="/admin/enquiries?status=new" />
        <MetricCard label="Quotations awaiting customer" value={k.quotations_awaiting} href="/admin/quotations?status=sent"
          hint={k.quotations_pending_approval ? `${k.quotations_pending_approval} pending internal approval` : undefined} />
        <MetricCard label="Confirmed orders" value={k.confirmed_orders} href="/admin/sales-orders?status=confirmed" />
        <MetricCard label="Awaiting dispatch" value={k.awaiting_dispatch} href="/admin/dispatches" />
        <MetricCard label="Invoices pending creation" value={k.invoices_pending} href="/admin/invoices?status=pending" tone={k.invoices_pending ? "warn" : undefined} />
        <MetricCard label="Overdue invoices" value={k.invoices_overdue} tone={k.invoices_overdue ? "danger" : undefined} href="/admin/invoices?filter=overdue"
          hint={`${k.invoices_unpaid} unpaid · from synced data only`} />
      </div>

      {k.integration_failures > 0 && (
        <Alert tone="error" className="mt-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {k.integration_failures} Zoho Books job(s) failed.{" "}
          <Link href="/admin/integrations" className="font-medium underline">Review and retry</Link>
        </Alert>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales — last 6 months" description={`Pending order value ${formatMoney(k.pending_order_value)} · excludes cancelled orders`} />
          {k.sales_by_month.length ? (
            <div className="flex h-56 items-end gap-3 px-4 pb-4 pt-6">
              {k.sales_by_month.map((x) => (
                <div key={x.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] text-muted tnum">{formatMoney(x.total).replace(/\.\d+$/, "")}</span>
                  <div className="w-full max-w-14 rounded-t bg-navy" style={{ height: `${(Number(x.total) / maxMonth) * 150}px` }}
                    title={`${x.orders} orders`} />
                  <span className="text-xs text-muted">{x.month}</span>
                </div>
              ))}
            </div>
          ) : <p className="p-6 text-sm text-muted">No sales orders yet. Confirmed orders will appear here.</p>}
        </Card>
        <Card>
          <CardHeader title="Quotation pipeline" />
          <div className="space-y-2 p-4">
            {pipelineOrder.filter((s) => k.quotation_pipeline[s]).map((s) => (
              <Link key={s} href={`/admin/quotations?status=${s}`} className="block">
                <div className="flex justify-between text-sm"><span>{humanize(s)}</span><span className="tnum text-muted">{k.quotation_pipeline[s]}</span></div>
                <div className="mt-1 h-1.5 rounded bg-canvas"><div className="h-1.5 rounded bg-brand" style={{ width: `${(k.quotation_pipeline[s] / pipeTotal) * 100}%` }} /></div>
              </Link>
            ))}
            {!Object.keys(k.quotation_pipeline).length && <p className="text-sm text-muted">No quotations yet.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Recent enquiries" action={<Link href="/admin/enquiries" className="text-xs text-navy hover:underline">View all</Link>} />
          <Timeline empty="No enquiries yet." items={(enquiries ?? []).map((e) => ({
            id: e.id, at: e.created_at,
            title: <Link href={`/admin/enquiries/${e.id}`} className="font-medium text-navy hover:underline">{e.enquiry_number}</Link>,
            body: <span>{(e.customers as unknown as { company_name: string } | null)?.company_name ?? e.contact_name} · <StatusBadge status={e.status} /></span>,
          }))} />
        </Card>
        <Card>
          <CardHeader title="Recent order activity" action={<Link href="/admin/sales-orders" className="text-xs text-navy hover:underline">View all</Link>} />
          <Timeline empty="No sales orders yet." items={(orders ?? []).map((o) => ({
            id: o.id, at: o.updated_at,
            title: <Link href={`/admin/sales-orders/${o.id}`} className="font-medium text-navy hover:underline">{o.order_number} · {formatMoney(o.grand_total)}</Link>,
            body: <span>{(o.customers as unknown as { company_name: string } | null)?.company_name} · <StatusBadge status={o.status} /></span>,
          }))} />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Low-stock alerts" action={<Link href="/admin/inventory?filter=low" className="text-xs text-navy hover:underline">Inventory</Link>} />
            {low.length ? (
              <ul className="divide-y divide-line">
                {low.map((r) => (
                  <li key={r.product_id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <Link href={`/admin/inventory/${r.product_id}`} className="truncate hover:text-navy">{r.name}</Link>
                    <span className={Number(r.available) <= 0 ? "text-danger tnum" : "text-amber-700 tnum"}>{formatQty(r.available)} / {formatQty(r.reorder_threshold)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="p-4 text-sm text-muted">All products above reorder level.</p>}
          </Card>
          <Card>
            <CardHeader title="Order status" />
            <div className="space-y-1.5 p-4">
              {Object.entries(k.order_status).map(([s, n]) => (
                <div key={s} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0"><StatusBadge status={s} /></span>
                  <div className="h-1.5 flex-1 rounded bg-canvas"><div className="h-1.5 rounded bg-navy" style={{ width: `${(n / orderTotal) * 100}%` }} /></div>
                  <span className="w-6 text-right tnum text-muted">{n}</span>
                </div>
              ))}
              {!Object.keys(k.order_status).length && <p className="text-sm text-muted">No orders yet.</p>}
            </div>
          </Card>
          {(failures ?? []).length > 0 && (
            <Card>
              <CardHeader title="Recent integration failures" />
              <ul className="divide-y divide-line text-sm">
                {failures!.map((f) => (
                  <li key={f.id} className="px-4 py-2"><p className="font-medium">{humanize(f.job_type)} · {f.attempts} attempts</p><p className="truncate text-xs text-danger">{f.last_error}</p><p className="text-xs text-muted">{formatDate(f.updated_at)}</p></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
