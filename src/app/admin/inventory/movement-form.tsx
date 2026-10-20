"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, Input, Select } from "@/components/ui/primitives";
import { recordMovement } from "./actions";

export function MovementForm({ productId, products }: { productId?: string; products?: { id: string; label: string }[] }) {
  const [type, setType] = useState("goods_received");
  const directional = type === "adjustment" || type === "correction";
  return (
    <ActionForm action={recordMovement} className="space-y-3" resetOnSuccess>
      {productId ? <input type="hidden" name="product_id" value={productId} /> : (
        <Field label="Product" name="product_id" required>
          <Select id="product_id" name="product_id" required defaultValue="">
            <option value="" disabled>Select product</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Movement type" name="movement_type">
        <Select id="movement_type" name="movement_type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="goods_received">Goods received</option>
          <option value="return">Customer return</option>
          <option value="adjustment">Manual adjustment</option>
          <option value="correction">Correction</option>
        </Select>
      </Field>
      {directional && (
        <Field label="Direction" name="direction">
          <Select id="direction" name="direction" defaultValue="out">
            <option value="in">Increase stock (+)</option>
            <option value="out">Decrease stock (−)</option>
          </Select>
        </Field>
      )}
      <Field label="Quantity" name="quantity" required><Input id="quantity" name="quantity" inputMode="decimal" required /></Field>
      <Field label="Reference document" name="reference" hint="GRN, supplier invoice, return note…"><Input id="reference" name="reference" /></Field>
      <Field label={directional ? "Reason (required)" : "Notes"} name="notes" required={directional}>
        <Input id="notes" name="notes" required={directional} />
      </Field>
      <SubmitButton className="w-full">Record movement</SubmitButton>
      <p className="text-xs text-muted">Stock cannot go below reserved quantity. Reservations and dispatches are recorded automatically from sales orders.</p>
    </ActionForm>
  );
}
