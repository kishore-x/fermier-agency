"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, FileUp, X } from "lucide-react";
import { raiseDirectPo, type DirectPoResult } from "@/app/portal/actions";
import { SubmitButton } from "@/components/ui/forms";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils";

type Props = {
  product: { id: string; name: string; sku: string; display_price: string | number | null; tax_rate: string | number; unit: string };
  defaultAddress: string;
  signedInAs: "customer" | "staff" | "guest";
  returnTo: string;
};

export function RaisePurchaseOrder({ product, defaultAddress, signedInAs, returnTo }: Props) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [amountEdited, setAmountEdited] = useState<string | null>(null);
  const [state, action] = useActionState<DirectPoResult, FormData>(raiseDirectPo, null);
  const unitTotal = product.display_price ? Number(product.display_price) * (1 + Number(product.tax_rate) / 100) : null;
  const suggested = unitTotal ? (Math.round(unitTotal * qty * 100) / 100).toFixed(2) : "";
  const today = new Date().toISOString().slice(0, 10);
  const e = state?.fieldErrors ?? {};

  if (signedInAs !== "customer") {
    return (
      <div className="rounded-md border border-dashed border-brand/40 bg-brand-50/50 p-3 text-sm">
        <p className="font-semibold text-ink-900">Ready to buy? Raise a purchase order online.</p>
        {signedInAs === "guest"
          ? <p className="mt-1 text-muted"><Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand hover:underline">Sign in</Link> or <Link href="/register" className="font-semibold text-brand hover:underline">open a trade account</Link> to upload your PO for this product.</p>
          : <p className="mt-1 text-muted">Customers can raise a PO from this page. Staff see incoming POs under Admin → Customer POs.</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" /> Raise purchase order
      </Button>
    );
  }

  if (state?.ok) {
    return (
      <div className="rounded-md border border-ok/30 bg-ok-50 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ok-600"><CheckCircle2 className="h-5 w-5" /> Purchase order {state.poNumber} submitted</p>
        <p className="mt-1 text-[#3d4652]">Reference <strong>{state.reference}</strong>. Our sales team has been notified and will confirm pricing, availability and delivery. You&apos;ll see the status in your account.</p>
        <div className="mt-3 flex gap-2">
          <Link href={`/portal/enquiries/${state.enquiryId}`} className="rounded-sm bg-brand px-3 py-1.5 text-xs font-bold uppercase text-white">Track request</Link>
          <Link href="/portal/purchase-orders" className="rounded-sm border border-brand px-3 py-1.5 text-xs font-bold uppercase text-brand">My purchase orders</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-md border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-ink-900">Raise purchase order</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      {state?.error && <Alert tone="error" className="mb-3">{state.error}</Alert>}
      <input type="hidden" name="product_id" value={product.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Quantity (${product.unit})`} name="quantity" required error={e.quantity}>
          <Input id="quantity" name="quantity" type="number" min={1} max={9999} value={qty} required
            onChange={(ev) => { setQty(Math.max(1, Math.min(9999, Number(ev.target.value) || 1))); setAmountEdited(null); }} />
        </Field>
        <Field label="PO number" name="po_number" required error={e.po_number}><Input id="po_number" name="po_number" required maxLength={60} /></Field>
        <Field label="PO date" name="po_date" required error={e.po_date}><Input id="po_date" name="po_date" type="date" defaultValue={today} required /></Field>
        <Field label="PO amount incl. GST (₹)" name="po_amount" required error={e.po_amount}
          hint={unitTotal ? `Indicative: ${formatMoney(suggested)} (${qty} × ${formatMoney(product.display_price)} + GST)` : "Price on request — enter the amount on your PO"}>
          <Input id="po_amount" name="po_amount" inputMode="decimal" required value={amountEdited ?? suggested} onChange={(ev) => setAmountEdited(ev.target.value)} />
        </Field>
        <Field label="Delivery address" name="delivery_address" required className="sm:col-span-2" error={e.delivery_address}>
          <Textarea id="delivery_address" name="delivery_address" rows={2} defaultValue={defaultAddress} required />
        </Field>
        <Field label="Required by" name="requested_date"><Input id="requested_date" name="requested_date" type="date" min={today} /></Field>
        <Field label="PO document (PDF/image, max 10 MB)" name="file" required error={e.file}>
          <input id="file" type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required
            className="block w-full text-sm file:mr-2 file:rounded-sm file:border-0 file:bg-band file:px-3 file:py-2 file:text-xs file:font-semibold" />
        </Field>
        <Field label="Notes" name="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" rows={2} placeholder="Unloading, site contact, billing instructions…" /></Field>
      </div>
      <p className="mt-3 text-xs text-muted">Your PO is reviewed by our sales team against final pricing and availability before the order is confirmed.</p>
      <SubmitButton className="mt-3 w-full" size="lg" pendingText="Submitting…">Submit purchase order</SubmitButton>
    </form>
  );
}
