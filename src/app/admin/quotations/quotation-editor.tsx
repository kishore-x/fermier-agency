"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { previewLine, previewTotals } from "@/lib/money";
import { formatMoney } from "@/lib/utils";
import { saveQuotation } from "./actions";

export type ProductOpt = { id: string; sku: string; name: string; selling_price: string | null; tax_rate: string; unit: string; available: number };
type Line = { key: number; product_id: string; quantity: string; unit_price: string; discount_pct: string; description: string };
type Header = {
  id?: string; customer_id?: string; enquiry_id?: string; billing_address?: string | null; delivery_address?: string | null; expiry_date?: string;
  payment_terms?: string | null; delivery_terms?: string | null; notes?: string | null; terms_and_conditions?: string | null;
  shipping_charges?: string; other_charges?: string; status?: string;
};

let seq = 1;

export function QuotationEditor({ header, lines: initial, products, customers, approvalPct, approvalAmount, myLimit }: {
  header: Header; lines: Omit<Line, "key">[]; products: ProductOpt[]; customers: { id: string; company_name: string; billing_address: string | null; payment_terms: string | null }[];
  approvalPct: number; approvalAmount: number; myLimit: number;
}) {
  const [lines, setLines] = useState<Line[]>(() => (initial.length ? initial : [{ product_id: "", quantity: "1", unit_price: "", discount_pct: "0", description: "" }]).map((l) => ({ ...l, key: seq++ })));
  const [customerId, setCustomerId] = useState(header.customer_id ?? "");
  const [shipping, setShipping] = useState(header.shipping_charges ?? "0");
  const [other, setOther] = useState(header.other_charges ?? "0");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const cust = customers.find((c) => c.id === customerId);

  const preview = lines.map((l) => ({ ...l, tax_rate: byId.get(l.product_id)?.tax_rate ?? "0" }));
  const totals = previewTotals(preview, shipping, other);
  const maxDisc = Math.max(0, ...lines.map((l) => Number(l.discount_pct || 0)));
  const needsApproval = maxDisc > Math.max(approvalPct, myLimit) || totals.grand > approvalAmount;
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <ActionForm action={saveQuotation} className="space-y-4">
      <input type="hidden" name="id" value={header.id ?? ""} />
      <input type="hidden" name="enquiry_id" value={header.enquiry_id ?? ""} />
      <input type="hidden" name="items" value={JSON.stringify(lines.filter((l) => l.product_id).map(({ key: _k, ...l }) => l))} />
      {header.status === "sent" && <Alert tone="warn">This quotation was already sent. Saving creates a new revision and it must be approved and sent again. Earlier versions stay in the history.</Alert>}

      <Card>
        <CardHeader title="Customer & terms" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer" name="customer_id" required>
            <Select id="customer_id" name="customer_id" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required disabled={!!header.enquiry_id && !!header.customer_id}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </Select>
            {!!header.enquiry_id && !!header.customer_id && <input type="hidden" name="customer_id" value={customerId} />}
          </Field>
          <Field label="Valid until" name="expiry_date"><Input id="expiry_date" name="expiry_date" type="date" defaultValue={header.expiry_date} /></Field>
          <Field label="Payment terms" name="payment_terms"><Input id="payment_terms" name="payment_terms" key={customerId} defaultValue={header.payment_terms ?? cust?.payment_terms ?? ""} /></Field>
          <Field label="Billing address" name="billing_address"><Textarea id="billing_address" name="billing_address" rows={2} key={`b${customerId}`} defaultValue={header.billing_address ?? cust?.billing_address ?? ""} /></Field>
          <Field label="Delivery address" name="delivery_address"><Textarea id="delivery_address" name="delivery_address" rows={2} defaultValue={header.delivery_address ?? ""} /></Field>
          <Field label="Delivery terms" name="delivery_terms"><Textarea id="delivery_terms" name="delivery_terms" rows={2} defaultValue={header.delivery_terms ?? "Ex-warehouse. Dispatch within 7 days of order confirmation, subject to stock."} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Line items" description="Prices default from the product master and exclude GST. Totals are recalculated on the server when you save."
          action={<Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { key: seq++, product_id: "", quantity: "1", unit_price: "", discount_pct: "0", description: "" }])}><Plus className="h-4 w-4" />Add line</Button>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted">
              <th className="px-3 py-2">Product</th><th className="w-24 px-3 py-2">Qty</th><th className="w-36 px-3 py-2">Unit price (₹)</th>
              <th className="w-24 px-3 py-2">Disc %</th><th className="w-20 px-3 py-2 text-right">GST</th><th className="w-32 px-3 py-2 text-right">Line total</th><th className="w-10" />
            </tr></thead>
            <tbody>
              {lines.map((l) => {
                const p = byId.get(l.product_id);
                const calc = previewLine({ ...l, tax_rate: p?.tax_rate ?? 0 });
                const short = p && Number(l.quantity) > p.available;
                return (
                  <tr key={l.key} className="border-b border-line align-top">
                    <td className="px-3 py-2">
                      <Select aria-label="Product" value={l.product_id} onChange={(e) => {
                        const np = byId.get(e.target.value);
                        update(l.key, { product_id: e.target.value, unit_price: np?.selling_price ?? "" });
                      }}>
                        <option value="">Select product…</option>
                        {products.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.sku}</option>)}
                      </Select>
                      <Input aria-label="Line description" className="mt-1 h-8 text-xs" placeholder="Optional description override" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} />
                      {p && <p className={`mt-1 text-xs ${short ? "text-amber-700" : "text-muted"}`}>{short && <AlertTriangle className="mr-1 inline h-3 w-3" />}{p.available} {p.unit} available now</p>}
                    </td>
                    <td className="px-3 py-2"><Input aria-label="Quantity" inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} /></td>
                    <td className="px-3 py-2"><Input aria-label="Unit price" inputMode="decimal" value={l.unit_price} placeholder={p?.selling_price ? "" : "Enter price"} onChange={(e) => update(l.key, { unit_price: e.target.value })} /></td>
                    <td className="px-3 py-2"><Input aria-label="Discount percent" inputMode="decimal" value={l.discount_pct} onChange={(e) => update(l.key, { discount_pct: e.target.value })} /></td>
                    <td className="px-3 py-2 pt-4 text-right text-muted">{p ? `${Number(p.tax_rate)}%` : "—"}</td>
                    <td className="px-3 py-2 pt-4 text-right font-medium tnum">{formatMoney(calc.total / 100)}</td>
                    <td className="px-1 py-2"><Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4 text-muted" /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <Field label="Notes to customer" name="notes"><Textarea id="notes" name="notes" rows={2} defaultValue={header.notes ?? ""} /></Field>
            <Field label="Terms & conditions" name="terms_and_conditions" hint="Defaults from company settings"><Textarea id="terms_and_conditions" name="terms_and_conditions" rows={4} defaultValue={header.terms_and_conditions ?? ""} /></Field>
          </div>
          <div className="space-y-2 rounded-md border border-line bg-canvas/40 p-3 text-sm">
            <Row label="Subtotal" v={totals.subtotal} />
            <Row label="Discount" v={-totals.discount} />
            <Row label="GST" v={totals.tax} />
            <div className="flex items-center justify-between gap-2"><label htmlFor="shipping_charges">Shipping</label><Input id="shipping_charges" name="shipping_charges" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} className="h-8 w-32 text-right" /></div>
            <div className="flex items-center justify-between gap-2"><label htmlFor="other_charges">Other charges</label><Input id="other_charges" name="other_charges" inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} className="h-8 w-32 text-right" /></div>
            <div className="flex justify-between border-t border-navy pt-2 text-base font-semibold"><span>Grand total</span><span className="tnum">{formatMoney(totals.grand)}</span></div>
            {needsApproval && <p className="text-xs text-amber-700">Requires Sales Manager approval (discount above {Math.max(approvalPct, myLimit)}% or total above {formatMoney(approvalAmount)}).</p>}
          </div>
        </div>
      </Card>
      <div className="flex justify-end"><SubmitButton pendingText="Saving…">{header.id ? "Save quotation" : "Create draft quotation"}</SubmitButton></div>
    </ActionForm>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className="tnum">{formatMoney(v)}</span></div>;
}
