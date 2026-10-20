import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, MessageCircle, Pencil, ShoppingBag } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, DescriptionList, Field, Input, LinkButton, PageHeader, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { getCompany, whatsappLink } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/utils";
import { emailQuotation, transitionQuotation, uploadCustomerPo } from "../actions";

export default async function QuotationDetail({ params, searchParams }: PageProps<"/admin/quotations/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const { saved } = (await searchParams) as { saved?: string };
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { data: versions }, { data: pos }, { data: so }, company] = await Promise.all([
    supabase.from("quotations").select("*, customers(id, company_name, email, phone, primary_contact), enquiries(id, enquiry_number), creator:profiles!quotations_created_by_fkey(full_name), approver:profiles!quotations_approved_by_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
    supabase.from("quotation_versions").select("id, revision, created_at, snapshot").eq("quotation_id", id).order("revision", { ascending: false }),
    supabase.from("customer_purchase_orders").select("id, po_number, po_amount, status, created_at").eq("quotation_id", id).order("created_at", { ascending: false }),
    supabase.from("sales_orders").select("id, order_number, status").eq("quotation_id", id).maybeSingle(),
    getCompany(),
  ]);
  if (!q) notFound();
  const cust = q.customers as { id: string; company_name: string; email: string | null; phone: string | null; primary_contact: string | null };
  const enq = q.enquiries as { id: string; enquiry_number: string } | null;
  const sell = can.sell(session);
  const approver = can.approve(session);
  const editable = sell && ["draft", "pending_approval", "approved", "sent", "rejected"].includes(q.status);
  const pdfUrl = `/admin/quotations/${q.id}/pdf`;
  const portalUrl = `${env.siteUrl()}/portal/quotations/${q.id}`;
  const waText = `Dear ${cust.primary_contact ?? "Sir/Madam"}, please find quotation ${q.quotation_number} for ${formatMoney(q.grand_total)} (valid until ${formatDate(q.expiry_date)}). View and accept it here: ${portalUrl}`;
  const wa = whatsappLink(cust.phone, waText);
  const verifiedPo = (pos ?? []).find((p) => p.status === "verified");
  const T = (action: string, label: string, opts: { tone?: "primary" | "danger" | "success"; desc?: string; note?: string; variant?: "outline" | "primary" | "success" } = {}) => (
    <ConfirmAction action={transitionQuotation} fields={{ id: q.id, action }} trigger={label} triggerVariant={opts.variant ?? "outline"} title={`${label}?`}
      description={opts.desc} confirmLabel={label} tone={opts.tone ?? "primary"} requireNote={opts.note} />
  );

  return (
    <>
      <PageHeader back={{ href: "/admin/quotations", label: "Quotations" }}
        title={<span className="flex items-center gap-2">{q.quotation_number}{q.revision > 1 && <span className="text-base font-normal text-muted">rev {q.revision}</span>} <StatusBadge status={q.status} /></span>}
        description={<><Link href={`/admin/customers/${cust.id}`} className="text-navy hover:underline">{cust.company_name}</Link>{enq && <> · from <Link href={`/admin/enquiries/${enq.id}`} className="text-navy hover:underline">{enq.enquiry_number}</Link></>} · {formatMoney(q.grand_total)}</>}
        actions={<>
          <LinkButton href={pdfUrl} variant="outline" target="_blank" prefetch={false}><FileDown className="h-4 w-4" />PDF</LinkButton>
          {editable && <LinkButton href={`/admin/quotations/${q.id}/edit`} variant="outline"><Pencil className="h-4 w-4" />{q.status === "sent" ? "Revise" : "Edit"}</LinkButton>}
          {sell && q.status === "draft" && T("submit", q.requires_approval ? "Submit for approval" : "Finalise", { variant: "primary", desc: q.requires_approval ? "Discount or value exceeds your limit; a Sales Manager must approve." : "Marks the quotation approved and ready to send." })}
          {approver && q.status === "pending_approval" && <>{T("reject_approval", "Return to draft", { tone: "danger", note: "Reason / changes required" })}{T("approve", "Approve", { variant: "success", tone: "success" })}</>}
          {so && <LinkButton href={`/admin/sales-orders/${so.id}`} variant="success"><ShoppingBag className="h-4 w-4" />{so.order_number}</LinkButton>}
        </>} />
      {saved && <Alert tone="success" className="mb-4">Saved. Totals were recalculated on the server{q.requires_approval ? " — this quotation needs manager approval before sending" : ""}.</Alert>}
      {q.status === "pending_approval" && !approver && <Alert tone="warn" className="mb-4">Waiting for Sales Manager approval.</Alert>}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit price</th><th className="px-4 py-2 text-right">Disc.</th><th className="px-4 py-2 text-right">GST</th><th className="px-4 py-2 text-right">Total</th>
              </tr></thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.id} className="border-b border-line">
                    <td className="px-4 py-2"><p className="font-medium">{i.name_snapshot}</p><p className="text-xs text-muted">{i.sku_snapshot}{i.description_snapshot ? ` — ${i.description_snapshot}` : ""}</p></td>
                    <td className="px-4 py-2 text-right tnum">{formatQty(i.quantity)} {i.unit}</td>
                    <td className="px-4 py-2 text-right tnum">{formatMoney(i.unit_price)}</td>
                    <td className="px-4 py-2 text-right tnum">{Number(i.discount_pct) ? `${Number(i.discount_pct)}%` : "—"}</td>
                    <td className="px-4 py-2 text-right tnum">{formatMoney(i.tax_amount)}<span className="block text-xs text-muted">{Number(i.tax_rate)}%</span></td>
                    <td className="px-4 py-2 text-right font-medium tnum">{formatMoney(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-full max-w-xs space-y-1 p-4 text-sm">
              {[["Subtotal", q.subtotal], ["Discount", -Number(q.discount_total)], ["GST", q.tax_total], ["Shipping", q.shipping_charges], ["Other charges", q.other_charges]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between"><span className="text-muted">{l}</span><span className="tnum">{formatMoney(v as string)}</span></div>
              ))}
              <div className="flex justify-between border-t border-navy pt-2 text-base font-semibold"><span>Grand total</span><span className="tnum">{formatMoney(q.grand_total)}</span></div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Terms" />
            <DescriptionList items={[
              ["Quotation date", formatDate(q.quotation_date)], ["Valid until", formatDate(q.expiry_date)], ["Payment terms", q.payment_terms], ["Delivery terms", q.delivery_terms],
              ["Billing address", q.billing_address], ["Delivery address", q.delivery_address], ["Notes", q.notes],
              ["Prepared by", (q.creator as { full_name: string } | null)?.full_name], ["Approved by", q.approved_at ? `${(q.approver as { full_name: string } | null)?.full_name} · ${formatDateTime(q.approved_at)}` : "—"],
            ]} />
            {q.terms_and_conditions && <p className="whitespace-pre-line border-t border-line p-4 text-xs text-muted">{q.terms_and_conditions}</p>}
          </Card>
        </div>

        <div className="space-y-4">
          {sell && ["approved", "sent"].includes(q.status) && (
            <Card>
              <CardHeader title="Send to customer" />
              <div className="space-y-3 p-4">
                {emailConfigured() ? (
                  <ActionForm action={emailQuotation} className="space-y-2">
                    <input type="hidden" name="id" value={q.id} />
                    <Field label="To" name="to"><Input id="to" name="to" type="email" defaultValue={cust.email ?? ""} required /></Field>
                    <Field label="Message" name="message"><Textarea id="message" name="message" rows={3} defaultValue="Please find our quotation attached. Let us know if you have any questions." /></Field>
                    <SubmitButton className="w-full" pendingText="Sending…">Email quotation PDF</SubmitButton>
                  </ActionForm>
                ) : (
                  <Alert tone="info">Email isn&apos;t configured (RESEND_API_KEY). Download the PDF or share via WhatsApp, then mark the quotation as sent.</Alert>
                )}
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-md border border-brand text-sm font-medium text-brand-600 hover:bg-brand-50">
                    <MessageCircle className="h-4 w-4" />Share link on WhatsApp
                  </a>
                ) : <p className="text-xs text-muted">Add a phone number to the customer to enable WhatsApp sharing.</p>}
                <p className="text-xs text-muted">Opening WhatsApp does not confirm delivery. Mark as sent once you&apos;ve shared it.</p>
                {q.status === "approved" && T("mark_sent", "Mark as sent", { variant: "primary", desc: "Locks this revision and shows it to the customer in their portal." })}
              </div>
            </Card>
          )}
          {sell && ["sent", "viewed"].includes(q.status) && (
            <Card>
              <CardHeader title="Customer response" description="Customers can also accept or reject from their portal." />
              <div className="flex flex-wrap gap-2 p-4">
                {T("accept", "Record acceptance", { variant: "success", tone: "success", note: "How was acceptance received? (email, call, signed copy…)" })}
                {T("reject", "Record rejection", { tone: "danger", note: "Reason given by customer" })}
                {T("expire", "Mark expired", { tone: "danger" })}
              </div>
            </Card>
          )}
          {["accepted", "converted"].includes(q.status) && (
            <Card>
              <CardHeader title="Customer purchase orders" description="Commercial terms of this quotation are now locked." />
              <ul className="divide-y divide-line text-sm">
                {(pos ?? []).map((p) => <li key={p.id} className="flex items-center justify-between px-4 py-2"><Link href={`/admin/purchase-orders/${p.id}`} className="text-navy hover:underline">{p.po_number}</Link><span className="tnum">{formatMoney(p.po_amount)}</span><StatusBadge status={p.status} /></li>)}
                {!pos?.length && <li className="px-4 py-3 text-muted">Waiting for the customer&apos;s PO.</li>}
              </ul>
              {sell && q.status === "accepted" && !verifiedPo && (
                <ActionForm action={uploadCustomerPo} resetOnSuccess className="space-y-2 border-t border-line p-4">
                  <input type="hidden" name="quotation_id" value={q.id} />
                  <p className="text-sm font-medium">Upload PO received from customer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="po_number" placeholder="PO number" aria-label="PO number" required />
                    <Input name="po_date" type="date" aria-label="PO date" required />
                  </div>
                  <Input name="po_amount" inputMode="decimal" placeholder={`PO amount (quote: ${Number(q.grand_total)})`} aria-label="PO amount" required />
                  <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="block w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-canvas file:px-2 file:py-1" aria-label="PO document" />
                  <Input name="notes" placeholder="Notes (optional)" aria-label="Notes" />
                  <SubmitButton size="sm" className="w-full" pendingText="Uploading…">Upload PO</SubmitButton>
                </ActionForm>
              )}
              {verifiedPo && !so && can.confirmOrders(session) && (
                <div className="border-t border-line p-4"><LinkButton href={`/admin/purchase-orders/${verifiedPo.id}`} variant="success" className="w-full">Confirm sales order</LinkButton></div>
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Version history" description="Snapshot saved each time the quotation is sent or accepted" />
            <ul className="divide-y divide-line text-sm">
              {(versions ?? []).map((v) => {
                const h = (v.snapshot as { header: { grand_total: string; status: string } }).header;
                return <li key={v.id} className="flex justify-between px-4 py-2"><span>Rev {v.revision} · <span className="text-muted">{h.status}</span></span><span className="tnum">{formatMoney(h.grand_total)}</span><span className="text-xs text-muted">{formatDateTime(v.created_at)}</span></li>;
              })}
              {!versions?.length && <li className="px-4 py-3 text-muted">No versions yet — created when sent.</li>}
            </ul>
          </Card>
          {company && <p className="px-1 text-xs text-muted">PDF branding uses Settings → company profile ({company.company_name}).</p>}
        </div>
      </div>
    </>
  );
}
