"use client";

import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, Input } from "@/components/ui/primitives";
import { dispatchOrder } from "../../orders-actions";

export function DispatchForm({ orderId, lines }: { orderId: string; lines: { id: string; name: string; sku: string; outstanding: number; reserved: number; unit: string }[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={dispatchOrder} resetOnSuccess className="space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1">Line</th><th className="py-1 text-right">Outstanding</th><th className="py-1 text-right">Reserved</th><th className="w-28 py-1 text-right">Dispatch now</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t border-line">
              <td className="py-2"><p className="font-medium">{l.name}</p><p className="text-xs text-muted">{l.sku}</p></td>
              <td className="py-2 text-right tnum">{l.outstanding} {l.unit}</td>
              <td className="py-2 text-right tnum">{l.reserved}</td>
              <td className="py-2 pl-2"><Input name={`qty_${l.id}`} inputMode="decimal" defaultValue={String(Math.min(l.outstanding, l.reserved))} aria-label={`Dispatch quantity for ${l.sku}`} className="h-9 text-right" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Dispatch date" name="dispatch_date"><Input id="dispatch_date" name="dispatch_date" type="date" defaultValue={today} /></Field>
        <Field label="Delivery method" name="delivery_method"><Input id="delivery_method" name="delivery_method" placeholder="Own truck, transporter…" /></Field>
        <Field label="Tracking / LR no." name="tracking_reference"><Input id="tracking_reference" name="tracking_reference" /></Field>
      </div>
      <Field label="Delivery document (optional)" name="document" hint="Delivery challan, LR copy — PDF or image, max 10 MB">
        <input id="document" type="file" name="document" accept="application/pdf,image/jpeg,image/png,image/webp" className="block text-sm" />
      </Field>
      <SubmitButton variant="success" pendingText="Recording…">Record dispatch</SubmitButton>
      <p className="text-xs text-muted">Physical stock is reduced only when the dispatch is recorded. Set a line to 0 to leave it for a later dispatch.</p>
    </ActionForm>
  );
}
