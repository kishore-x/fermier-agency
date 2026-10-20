"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/components/catalog/cart";
import { ProductImage } from "@/components/catalog/category-icon";
import { SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, EmptyState, Field, Input, LinkButton, Select, Textarea } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils";
import { submitOrderRequest, type SubmitResult } from "../actions";

export function CartView({ addresses }: { addresses: { id: string; text: string }[] }) {
  const cart = useCart();
  const [state, action] = useActionState<SubmitResult, FormData>(submitOrderRequest, null);
  useEffect(() => { if (state?.ok) cart.clear(); }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.ok) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-ok" />
        <h1 className="mt-3 text-xl font-semibold">Order request submitted</h1>
        <p className="mt-1 text-sm text-muted">Your reference number is</p>
        <p className="mt-1 text-2xl font-bold tracking-wide text-navy">{state.reference}</p>
        <p className="mt-3 text-sm text-muted">Our sales team has been notified and will send you a formal quotation. This is a request, not a confirmed order — prices and availability are confirmed on the quotation.</p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton href={`/portal/enquiries/${state.enquiryId}`}>Track this request</LinkButton>
          <LinkButton href="/catalog" variant="outline">Continue browsing</LinkButton>
        </div>
      </Card>
    );
  }
  if (!cart.ready) return null;
  if (!cart.lines.length) {
    return <Card><EmptyState icon={<ShoppingCart className="h-10 w-10" />} title="Your cart is empty" description="Browse the catalog and add products to request a quotation." action={<LinkButton href="/catalog" variant="success">Browse catalog</LinkButton>} /></Card>;
  }
  const priced = cart.lines.filter((l) => l.price);
  const estimate = priced.reduce((a, l) => a + Number(l.price) * l.quantity, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="items" value={JSON.stringify(cart.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })))} />
      <Card>
        <CardHeader title={`Items (${cart.lines.length})`} />
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={l.productId} className="flex gap-3 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-line bg-white p-1"><ProductImage src={l.imageUrl} alt={l.name} /></div>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${l.slug}`} className="font-medium hover:text-navy">{l.name}</Link>
                <p className="text-xs text-muted">{l.sku}</p>
                <p className="mt-1 text-sm">{l.price ? <>{formatMoney(l.price)} <span className="text-xs text-muted">/ {l.unit} + GST (indicative)</span></> : <span className="text-navy">Price on request</span>}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-9 items-center rounded-md border border-line">
                    <button type="button" className="px-2 text-muted" onClick={() => cart.setQty(l.productId, l.quantity - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                    <input type="number" min={1} value={l.quantity} onChange={(e) => cart.setQty(l.productId, Number(e.target.value))} className="w-14 border-x border-line text-center text-sm" aria-label={`Quantity of ${l.name}`} />
                    <button type="button" className="px-2 text-muted" onClick={() => cart.setQty(l.productId, l.quantity + 1)} aria-label="Increase"><Plus className="h-4 w-4" /></button>
                  </div>
                  <button type="button" onClick={() => cart.remove(l.productId)} className="flex items-center gap-1 text-sm text-muted hover:text-danger"><Trash2 className="h-4 w-4" />Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Delivery & notes" />
          <div className="space-y-3 p-4">
            {state?.error && <Alert tone="error">{state.error}</Alert>}
            {addresses.length > 0 && (
              <Field label="Saved addresses" name="saved">
                <Select id="saved" onChange={(e) => { const ta = document.getElementById("delivery_address") as HTMLTextAreaElement; if (e.target.value) ta.value = e.target.value; }}>
                  <option value="">Choose a saved address…</option>
                  {addresses.map((a) => <option key={a.id} value={a.text}>{a.text}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Delivery address" name="delivery_address" required><Textarea id="delivery_address" name="delivery_address" rows={3} required defaultValue={addresses[0]?.text ?? ""} /></Field>
            <Field label="Requested delivery date" name="requested_delivery_date"><Input id="requested_delivery_date" name="requested_delivery_date" type="date" min={today} /></Field>
            <Field label="Notes for our sales team" name="notes"><Textarea id="notes" name="notes" rows={3} placeholder="Site details, unloading, preferred brands…" /></Field>
          </div>
        </Card>
        <Card className="p-4">
          {priced.length > 0 && <div className="flex justify-between text-sm"><span className="text-muted">Indicative value ({priced.length} priced item{priced.length > 1 ? "s" : ""})</span><span className="font-semibold tnum">{formatMoney(estimate)}</span></div>}
          {priced.length < cart.lines.length && <p className="mt-1 text-xs text-muted">Items with price on request will be priced on your quotation.</p>}
          <p className="mt-2 text-xs text-muted">Excludes GST and freight. Final prices are confirmed on the formal quotation.</p>
          <SubmitButton variant="success" size="lg" className="mt-4 w-full" pendingText="Submitting…">Submit order request</SubmitButton>
        </Card>
      </div>
    </form>
  );
}
