import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, DescriptionList, Field, Input, LinkButton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import { respondToQuotation, uploadMyPo } from "../../actions";

export default async function MyQuotation({ params }: PageProps<"/portal/quotations/[id]">) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { data: pos }, { data: so }] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
    supabase.from("customer_purchase_orders").select("id, po_number, po_amount, status, verification_notes, created_at").eq("quotation_id", id).order("created_at", { ascending: false }),
    supabase.from("sales_orders").select("id, order_number").eq("quotation_id", id).maybeSingle(),
  ]);
  if (!q) notFound();
  const expired = q.expiry_date < new Date().toISOString().slice(0, 10);
  const canRespond = ["sent", "viewed"].includes(q.status) && !expired;
  const needsPo = q.status === "accepted" && !(pos ?? []).some((p) => ["received", "verified"].includes(p.status));
  return (
    <>
      <Link href="/portal/quotations" className="text-sm text-muted hover:text-ink">← Quotations</Link>
      <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{q.quotation_number}{q.revision > 1 && <span className="ml-2 text-base font-normal text-muted">rev {q.revision}</span>}</h1><StatusBadge status={q.status} /></div>
        <div className="flex gap-2">
          <LinkButton href={`/portal/quotations/${q.id}/pdf`} variant="outline" target="_blank" prefetch={false}><FileDown className="h-4 w-4" />Download PDF</LinkButton>
          {so && <LinkButton href={`/portal/orders/${so.id}`} variant="success">View order {so.order_number}</LinkButton>}
        </div>
      </div>
      {canRespond && <Alert tone="info" className="mb-4">Please review and accept this quotation by {formatDate(q.expiry_date)}. After accepting, upload your purchase order to confirm.</Alert>}
      {["sent", "viewed"].includes(q.status) && expired && <Alert tone="warn" className="mb-4">This quotation expired on {formatDate(q.expiry_date)}. Contact your salesperson for a revised quotation.</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit price</th><th className="px-4 py-2 text-right">Disc.</th><th className="px-4 py-2 text-right">GST</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
              <tbody>{(items ?? []).map((i) => (
                <tr key={i.id} className="border-b border-line">
                  <td className="px-4 py-2"><p className="font-medium">{i.name_snapshot}</p><p className="text-xs text-muted">{i.sku_snapshot}</p></td>
                  <td className="px-4 py-2 text-right tnum">{formatQty(i.quantity)} {i.unit}</td>
                  <td className="px-4 py-2 text-right tnum">{formatMoney(i.unit_price)}</td>
                  <td className="px-4 py-2 text-right tnum">{Number(i.discount_pct) ? `${Number(i.discount_pct)}%` : "—"}</td>
                  <td className="px-4 py-2 text-right tnum">{formatMoney(i.tax_amount)}</td>
                  <td className="px-4 py-2 text-right font-medium tnum">{formatMoney(i.line_total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="ml-auto max-w-xs space-y-1 p-4 text-sm">
            {[["Subtotal", q.subtotal], ["Discount", -Number(q.discount_total)], ["GST", q.tax_total], ["Shipping", q.shipping_charges], ["Other charges", q.other_charges]].filter(([, v]) => Number(v)).map(([l, v]) => <div key={l as string} className="flex justify-between"><span className="text-muted">{l}</span><span className="tnum">{formatMoney(v as string)}</span></div>)}
            <div className="flex justify-between border-t border-navy pt-2 text-base font-semibold"><span>Grand total</span><span className="tnum">{formatMoney(q.grand_total)}</span></div>
          </div>
          <DescriptionList items={[["Valid until", formatDate(q.expiry_date)], ["Payment terms", q.payment_terms], ["Delivery terms", q.delivery_terms], ["Delivery address", q.delivery_address], ["Notes", q.notes]]} />
        </Card>
        <div className="space-y-4">
          {canRespond && (
            <Card>
              <CardHeader title="Your response" />
              <div className="flex gap-2 p-4">
                <ConfirmAction action={respondToQuotation} fields={{ id: q.id, decision: "accept" }} trigger="Accept quotation" triggerVariant="success" tone="success" title="Accept this quotation?" description={`You agree to the prices and terms totalling ${formatMoney(q.grand_total)}. You'll then upload your purchase order.`} confirmLabel="Accept" />
                <ConfirmAction action={respondToQuotation} fields={{ id: q.id, decision: "reject" }} trigger="Decline" tone="danger" title="Decline this quotation?" confirmLabel="Decline" />
              </div>
            </Card>
          )}
          {["accepted", "converted"].includes(q.status) && (
            <Card>
              <CardHeader title="Purchase order" description="Issue your PO for the exact quotation total" />
              <ul className="divide-y divide-line text-sm">
                {(pos ?? []).map((p) => (
                  <li key={p.id} className="px-4 py-2">
                    <div className="flex items-center justify-between"><span className="font-medium">{p.po_number}</span><span className="tnum">{formatMoney(p.po_amount)}</span><StatusBadge status={p.status} /></div>
                    {p.status === "requires_correction" && p.verification_notes && <p className="mt-1 text-xs text-amber-800">{p.verification_notes}</p>}
                  </li>
                ))}
              </ul>
              {needsPo && (
                <ActionForm action={uploadMyPo} resetOnSuccess className="space-y-2 border-t border-line p-4">
                  <input type="hidden" name="quotation_id" value={q.id} />
                  <Field label="PO number" name="po_number" required><Input id="po_number" name="po_number" required /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="PO date" name="po_date" required><Input id="po_date" name="po_date" type="date" required /></Field>
                    <Field label="PO amount (₹)" name="po_amount" required hint={`Quote: ${formatMoney(q.grand_total)}`}><Input id="po_amount" name="po_amount" inputMode="decimal" required defaultValue={String(Number(q.grand_total))} /></Field>
                  </div>
                  <Field label="PO document" name="file" required hint="PDF, JPG, PNG or WebP · max 10 MB">
                    <input id="file" type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
                  </Field>
                  <Field label="Notes" name="notes"><Input id="notes" name="notes" /></Field>
                  <SubmitButton className="w-full" variant="success" pendingText="Uploading…">Upload purchase order</SubmitButton>
                </ActionForm>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
