import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileDown } from "lucide-react";
import { ConfirmAction } from "@/components/ui/forms";
import { Timeline } from "@/components/ui/data";
import { Alert, Card, CardHeader, DescriptionList, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, formatQty, humanize } from "@/lib/utils";
import { cancelOrder, completeOrder, confirmDelivery, createInvoiceNow, reserveStock } from "../../orders-actions";
import { retryIntegrationJob } from "../../integrations/actions";
import { DispatchForm } from "./dispatch-form";

const FLOW = ["confirmed", "stock_reserved", "partially_fulfilled", "dispatched", "delivered", "completed"];

export default async function SalesOrderDetail({ params, searchParams }: PageProps<"/admin/sales-orders/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const { confirmed } = (await searchParams) as { confirmed?: string };
  const supabase = await createClient();
  const [{ data: so }, { data: items }, { data: reservations }, { data: dispatches }, { data: invoice }, { data: job }, { data: audit }] = await Promise.all([
    supabase.from("sales_orders").select("*, customers(id, company_name), quotations(id, quotation_number, revision), customer_purchase_orders(id, po_number, storage_path), profiles!sales_orders_salesperson_id_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("sales_order_items").select("*").eq("sales_order_id", id).order("sort_order"),
    supabase.from("stock_reservations").select("sales_order_item_id, quantity, status").eq("sales_order_id", id),
    supabase.from("dispatches").select("id, dispatch_number, dispatch_date, delivery_method, tracking_reference, delivered_at, document_path, dispatch_items(quantity, sales_order_item_id)").eq("sales_order_id", id).order("created_at"),
    supabase.from("invoices").select("*").eq("sales_order_id", id).maybeSingle(),
    supabase.from("integration_jobs").select("id, status, last_error, attempts").eq("entity_id", id).maybeSingle(),
    supabase.from("customer_activities").select("id, summary, created_at, profiles(full_name)").eq("reference_id", id).order("created_at", { ascending: false }),
  ]);
  if (!so) notFound();
  const cust = so.customers as { id: string; company_name: string };
  const qt = so.quotations as { id: string; quotation_number: string; revision: number };
  const po = so.customer_purchase_orders as { id: string; po_number: string } | null;
  const resByItem = new Map<string, number>();
  (reservations ?? []).filter((r) => r.status === "active").forEach((r) => resByItem.set(r.sales_order_item_id, (resByItem.get(r.sales_order_item_id) ?? 0) + Number(r.quantity)));
  const outstanding = (items ?? []).map((i) => ({ id: i.id, name: i.name_snapshot, sku: i.sku_snapshot, unit: i.unit, outstanding: Number(i.quantity) - Number(i.dispatched_quantity), reserved: resByItem.get(i.id) ?? 0 })).filter((l) => l.outstanding > 0);
  const canDispatch = can.dispatch(session) && ["stock_reserved", "partially_fulfilled", "ready_for_dispatch"].includes(so.status) && outstanding.length > 0;
  const cancellable = can.confirmOrders(session) && !["dispatched", "delivered", "completed", "cancelled"].includes(so.status);
  const docUrls = new Map<string, string>();
  for (const d of dispatches ?? []) {
    if (d.document_path) {
      const { data } = await supabase.storage.from("customer-documents").createSignedUrl(d.document_path, 600);
      if (data) docUrls.set(d.id, data.signedUrl);
    }
  }
  const stepIdx = FLOW.indexOf(so.status === "ready_for_dispatch" ? "stock_reserved" : so.status);

  return (
    <>
      <PageHeader back={{ href: "/admin/sales-orders", label: "Sales orders" }}
        title={<span className="flex items-center gap-2">{so.order_number} <StatusBadge status={so.status} /></span>}
        description={<><Link href={`/admin/customers/${cust.id}`} className="text-navy hover:underline">{cust.company_name}</Link> · from <Link href={`/admin/quotations/${qt.id}`} className="text-navy hover:underline">{qt.quotation_number}</Link>{po && <> · PO <Link href={`/admin/purchase-orders/${po.id}`} className="text-navy hover:underline">{po.po_number}</Link></>}</>}
        actions={<>
          <LinkButton href={`/admin/quotations/${qt.id}/pdf`} variant="outline" target="_blank" prefetch={false}><FileDown className="h-4 w-4" />Accepted quotation</LinkButton>
          {so.status === "confirmed" && (can.confirmOrders(session) || can.manageInventory(session)) && <ConfirmAction action={reserveStock} fields={{ id: so.id }} trigger="Reserve stock" triggerVariant="primary" title="Reserve stock for all lines?" description="Reduces available stock without moving physical stock. Fails if any line lacks availability." confirmLabel="Reserve" />}
          {can.confirmOrders(session) && ["dispatched", "delivered"].includes(so.status) && <ConfirmAction action={completeOrder} fields={{ id: so.id }} trigger="Mark completed" title="Complete this order?" confirmLabel="Complete" tone="success" />}
          {cancellable && <ConfirmAction action={cancelOrder} fields={{ id: so.id }} trigger="Cancel order" tone="danger" title="Cancel this order?" description="Releases any reserved stock. Cannot be undone." requireNote="Cancellation reason (required)" confirmLabel="Cancel order" />}
        </>} />
      {confirmed && <Alert tone="success" className="mb-4">Sales order confirmed with the accepted prices and terms. Next: reserve stock.</Alert>}
      {so.status === "cancelled" && <Alert tone="error" className="mb-4">Cancelled: {so.cancelled_reason}</Alert>}

      {so.status !== "cancelled" && (
        <ol className="mb-4 flex overflow-x-auto rounded-lg border border-line bg-white text-xs">
          {FLOW.map((s, i) => (
            <li key={s} className={`flex-1 whitespace-nowrap border-r border-line px-3 py-2 text-center last:border-0 ${i <= stepIdx ? "bg-brand-50 font-medium text-brand-600" : "text-muted"}`}>{i + 1}. {humanize(s)}</li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Confirmed lines" description="Prices are locked to the accepted quotation" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Ordered</th><th className="px-4 py-2 text-right">Reserved</th><th className="px-4 py-2 text-right">Dispatched</th><th className="px-4 py-2 text-right">Unit price</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                <tbody>{(items ?? []).map((i) => (
                  <tr key={i.id} className="border-b border-line">
                    <td className="px-4 py-2"><p className="font-medium">{i.name_snapshot}</p><p className="text-xs text-muted">{i.sku_snapshot}{Number(i.discount_pct) ? ` · ${Number(i.discount_pct)}% disc.` : ""} · GST {Number(i.tax_rate)}%</p></td>
                    <td className="px-4 py-2 text-right tnum">{formatQty(i.quantity)} {i.unit}</td>
                    <td className="px-4 py-2 text-right tnum">{formatQty(resByItem.get(i.id) ?? 0)}</td>
                    <td className="px-4 py-2 text-right tnum">{formatQty(i.dispatched_quantity)}</td>
                    <td className="px-4 py-2 text-right tnum">{formatMoney(i.unit_price)}</td>
                    <td className="px-4 py-2 text-right font-medium tnum">{formatMoney(i.line_total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="ml-auto max-w-xs space-y-1 p-4 text-sm">
              {[["Subtotal", so.subtotal], ["Discount", -Number(so.discount_total)], ["GST", so.tax_total], ["Shipping", so.shipping_charges], ["Other", so.other_charges]].map(([l, v]) => <div key={l as string} className="flex justify-between"><span className="text-muted">{l}</span><span className="tnum">{formatMoney(v as string)}</span></div>)}
              <div className="flex justify-between border-t border-navy pt-2 text-base font-semibold"><span>Order total</span><span className="tnum">{formatMoney(so.grand_total)}</span></div>
            </div>
          </Card>

          {canDispatch && (
            <Card>
              <CardHeader title="Record dispatch" description="Partial dispatches are supported" />
              <div className="p-4"><DispatchForm orderId={so.id} lines={outstanding} /></div>
            </Card>
          )}

          <Card>
            <CardHeader title={`Dispatches (${dispatches?.length ?? 0})`} />
            <ul className="divide-y divide-line text-sm">
              {(dispatches ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="font-medium">{d.dispatch_number} · {formatDate(d.dispatch_date)}</p>
                    <p className="text-xs text-muted">{[d.delivery_method, d.tracking_reference && `Ref ${d.tracking_reference}`, `${(d.dispatch_items as { quantity: string }[]).reduce((a, x) => a + Number(x.quantity), 0)} units`].filter(Boolean).join(" · ")}</p>
                  </div>
                  {docUrls.get(d.id) && <Link href={docUrls.get(d.id)!} target="_blank" className="text-xs text-navy hover:underline">Delivery doc</Link>}
                  {d.delivered_at ? <StatusBadge status="delivered" label={`Delivered ${formatDate(d.delivered_at)}`} />
                    : can.dispatch(session) || can.confirmOrders(session) ? <ConfirmAction action={confirmDelivery} fields={{ dispatch_id: d.id }} trigger="Confirm delivery" title={`Confirm delivery of ${d.dispatch_number}?`} requireNote="Received by / POD details" confirmLabel="Confirm" tone="success" />
                    : <StatusBadge status="dispatched" label="In transit" />}
                </li>
              ))}
              {!dispatches?.length && <li className="px-4 py-3 text-muted">Nothing dispatched yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Invoice" description="Zoho Books is the source of truth for invoices and payments" />
            <div className="space-y-3 p-4 text-sm">
              {invoice ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{invoice.external_invoice_number ?? "Not yet created"}</span>
                    <StatusBadge status={invoice.is_mock ? "mock" : invoice.sync_status} label={invoice.is_mock ? "Simulated — not in Zoho" : undefined} />
                  </div>
                  {invoice.is_mock && <Alert tone="info">Demo handoff only. This invoice number was generated locally in mock mode; it does not exist in Zoho Books.</Alert>}
                  {(invoice.sync_status === "created" || invoice.is_mock) && (
                    <DescriptionList cols={2} items={[["Total", formatMoney(invoice.total)], ["Balance due", invoice.is_mock ? `${formatMoney(invoice.balance_due)} (simulated)` : formatMoney(invoice.balance_due)],
                      ["Zoho status", invoice.external_status ?? "—"], ["Due", formatDate(invoice.due_date)], ["Last synced", formatDateTime(invoice.last_synced_at)]]} />
                  )}
                  {invoice.external_url && !invoice.is_mock && <Link href={invoice.external_url} target="_blank" className="flex items-center gap-1 text-navy hover:underline">Open in Zoho Books <ExternalLink className="h-3.5 w-3.5" /></Link>}
                  {job?.status === "failed" && <Alert tone="error">{job.last_error}</Alert>}
                  {job && ["failed", "pending"].includes(job.status) && can.confirmOrders(session) && <ConfirmAction action={retryIntegrationJob} fields={{ job_id: job.id }} trigger="Retry invoice creation" title="Retry now?" confirmLabel="Retry" />}
                </>
              ) : so.status === "cancelled" ? <p className="text-muted">Cancelled orders are not invoiced.</p> : (
                <>
                  <p className="text-muted">No invoice yet. It will be queued automatically at the configured stage, or create it now.</p>
                  {can.confirmOrders(session) && <ConfirmAction action={createInvoiceNow} fields={{ id: so.id }} trigger="Create invoice now" triggerVariant="primary" title="Create invoice?" description="Sends this order to Zoho Books (or simulates it in mock mode). Safe to retry — duplicates are prevented." confirmLabel="Create invoice" />}
                </>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Order details" />
            <DescriptionList cols={1} items={[["Order date", formatDate(so.order_date)], ["Requested delivery", formatDate(so.requested_delivery_date)], ["Delivery address", so.delivery_address], ["Payment terms", so.payment_terms], ["Salesperson", (so.profiles as { full_name: string } | null)?.full_name]]} />
          </Card>
          <Card>
            <CardHeader title="History" />
            <Timeline items={(audit ?? []).map((a) => ({ id: a.id, at: a.created_at, title: a.summary, actor: (a.profiles as unknown as { full_name: string } | null)?.full_name }))} />
          </Card>
        </div>
      </div>
    </>
  );
}
