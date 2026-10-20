import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileDown } from "lucide-react";
import { Alert, Card, CardHeader, DescriptionList, LinkButton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatQty, humanize } from "@/lib/utils";

const FLOW = ["confirmed", "stock_reserved", "partially_fulfilled", "dispatched", "delivered", "completed"];

export default async function MyOrder({ params }: PageProps<"/portal/orders/[id]">) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: so }, { data: items }, { data: dispatches }, { data: invoice }] = await Promise.all([
    supabase.from("sales_orders").select("*, quotations(id, quotation_number), customer_purchase_orders(po_number)").eq("id", id).maybeSingle(),
    supabase.from("sales_order_items").select("*").eq("sales_order_id", id).order("sort_order"),
    supabase.from("dispatches").select("id, dispatch_number, dispatch_date, delivery_method, tracking_reference, delivered_at, document_path").eq("sales_order_id", id).order("created_at"),
    supabase.from("invoices").select("external_invoice_number, external_url, is_mock, sync_status, external_status, total, balance_due, due_date").eq("sales_order_id", id).maybeSingle(),
  ]);
  if (!so) notFound();
  const qt = so.quotations as { id: string; quotation_number: string };
  const docs = new Map<string, string>();
  for (const d of dispatches ?? []) {
    if (d.document_path) { const { data } = await supabase.storage.from("customer-documents").createSignedUrl(d.document_path, 600); if (data) docs.set(d.id, data.signedUrl); }
  }
  const stepIdx = FLOW.indexOf(so.status === "ready_for_dispatch" ? "stock_reserved" : so.status);
  const invoiceReady = invoice && (invoice.sync_status === "created" || invoice.is_mock);
  return (
    <>
      <Link href="/portal/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
      <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{so.order_number}</h1><StatusBadge status={so.status} /></div>
        <LinkButton href={`/portal/quotations/${qt.id}/pdf`} variant="outline" target="_blank" prefetch={false}><FileDown className="h-4 w-4" />Accepted quotation</LinkButton>
      </div>
      {so.status === "cancelled" ? <Alert tone="error" className="mb-4">This order was cancelled. {so.cancelled_reason}</Alert> : (
        <ol className="mb-4 grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-white text-center text-[11px] sm:grid-cols-6 sm:text-xs">
          {FLOW.map((s, i) => <li key={s} className={`border-b border-r border-line px-1 py-2 sm:border-b-0 ${i <= stepIdx ? "bg-brand-50 font-medium text-brand-600" : "text-muted"}`}>{humanize(s)}</li>)}
        </ol>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Items" />
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Ordered</th><th className="px-4 py-2 text-right">Dispatched</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
              <tbody>{(items ?? []).map((i) => (
                <tr key={i.id} className="border-b border-line"><td className="px-4 py-2"><p className="font-medium">{i.name_snapshot}</p><p className="text-xs text-muted">{i.sku_snapshot}</p></td>
                  <td className="px-4 py-2 text-right tnum">{formatQty(i.quantity)}</td><td className="px-4 py-2 text-right tnum">{formatQty(i.dispatched_quantity)}</td><td className="px-4 py-2 text-right tnum">{formatMoney(i.line_total)}</td></tr>
              ))}</tbody>
            </table>
            <div className="flex justify-end gap-6 p-4 text-base font-semibold"><span>Order total</span><span className="tnum">{formatMoney(so.grand_total)}</span></div>
          </Card>
          <Card>
            <CardHeader title="Shipments" />
            <ul className="divide-y divide-line text-sm">
              {(dispatches ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex-1"><p className="font-medium">{d.dispatch_number} · {formatDate(d.dispatch_date)}</p><p className="text-xs text-muted">{[d.delivery_method, d.tracking_reference && `Tracking: ${d.tracking_reference}`].filter(Boolean).join(" · ")}</p></div>
                  {docs.get(d.id) && <Link href={docs.get(d.id)!} target="_blank" className="text-xs text-navy hover:underline">Delivery document</Link>}
                  <StatusBadge status={d.delivered_at ? "delivered" : "dispatched"} label={d.delivered_at ? `Delivered ${formatDate(d.delivered_at)}` : "In transit"} />
                </li>
              ))}
              {!dispatches?.length && <li className="px-4 py-3 text-muted">Not dispatched yet.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Invoice" />
            <div className="space-y-2 p-4 text-sm">
              {!invoice ? <p className="text-muted">Your invoice will appear here once issued.</p>
                : !invoiceReady ? <p className="text-muted">Invoice is being prepared.</p> : (
                  <>
                    <p className="text-base font-semibold">{invoice.external_invoice_number}{invoice.is_mock && <StatusBadge status="mock" label="Demo — simulated" className="ml-2" />}</p>
                    <DescriptionList cols={2} items={[["Amount", formatMoney(invoice.total)], ["Balance due", formatMoney(invoice.balance_due)], ["Due date", formatDate(invoice.due_date)], ["Status", invoice.is_mock ? "Simulated" : humanize(invoice.external_status)]]} />
                    {invoice.external_url && !invoice.is_mock && <Link href={invoice.external_url} target="_blank" className="flex items-center gap-1 text-navy hover:underline">View invoice <ExternalLink className="h-3.5 w-3.5" /></Link>}
                  </>
                )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Order details" />
            <DescriptionList cols={1} items={[["Quotation", qt.quotation_number], ["Your PO", (so.customer_purchase_orders as { po_number: string } | null)?.po_number], ["Ordered", formatDate(so.order_date)], ["Requested delivery", formatDate(so.requested_delivery_date)], ["Delivery address", so.delivery_address], ["Payment terms", so.payment_terms]]} />
          </Card>
        </div>
      </div>
    </>
  );
}
