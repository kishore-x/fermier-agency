"use client";

import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, FormSection, Input, Select, Textarea } from "@/components/ui/primitives";
import { saveCustomer } from "./actions";

type C = Partial<Record<"id" | "company_name" | "customer_type" | "primary_contact" | "email" | "phone" | "gstin" | "billing_address" | "state" | "country" | "payment_terms" | "credit_limit" | "salesperson_id" | "status" | "internal_notes", string | null>>;

export function CustomerForm({ c = {}, salespeople, canManageTerms }: { c?: C; salespeople: { id: string; full_name: string }[]; canManageTerms: boolean }) {
  const v = (k: keyof C) => c[k] ?? "";
  return (
    <ActionForm action={saveCustomer} className="space-y-4">
      {(s) => {
        const e = s?.fieldErrors ?? {};
        return (
          <>
            <input type="hidden" name="id" value={v("id")} />
            <FormSection title="Company">
              <Field label="Company name" name="company_name" required error={e.company_name}><Input id="company_name" name="company_name" defaultValue={v("company_name")} required /></Field>
              <Field label="Customer type" name="customer_type">
                <Select id="customer_type" name="customer_type" defaultValue={v("customer_type") || "business"}>
                  {["business", "contractor", "dealer", "retail", "government", "individual"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </Select>
              </Field>
              <Field label="GSTIN" name="gstin" error={e.gstin}><Input id="gstin" name="gstin" defaultValue={v("gstin")} maxLength={15} className="uppercase" /></Field>
              <Field label="Status" name="status">
                <Select id="status" name="status" defaultValue={v("status") || "active"}><option value="active">Active</option><option value="on_hold">On hold</option><option value="inactive">Inactive</option></Select>
              </Field>
            </FormSection>
            <FormSection title="Contact">
              <Field label="Primary contact" name="primary_contact"><Input id="primary_contact" name="primary_contact" defaultValue={v("primary_contact")} /></Field>
              <Field label="Email" name="email" error={e.email}><Input id="email" name="email" type="email" defaultValue={v("email")} /></Field>
              <Field label="Phone" name="phone"><Input id="phone" name="phone" defaultValue={v("phone")} /></Field>
              <Field label="State" name="state"><Input id="state" name="state" defaultValue={v("state")} /></Field>
              <Field label="Country" name="country"><Input id="country" name="country" defaultValue={v("country") || "India"} /></Field>
              <Field label="Billing address" name="billing_address" className="sm:col-span-2"><Textarea id="billing_address" name="billing_address" rows={2} defaultValue={v("billing_address")} /></Field>
            </FormSection>
            <FormSection title="Commercial">
              <Field label="Payment terms" name="payment_terms"><Input id="payment_terms" name="payment_terms" defaultValue={v("payment_terms") || "Net 30"} /></Field>
              <Field label="Credit limit (₹)" name="credit_limit" error={e.credit_limit} hint={canManageTerms ? undefined : "Managers only"}>
                <Input id="credit_limit" name="credit_limit" inputMode="decimal" defaultValue={v("credit_limit")} disabled={!canManageTerms} />
              </Field>
              <Field label="Assigned salesperson" name="salesperson_id" hint={canManageTerms ? undefined : "Managers only"}>
                <Select id="salesperson_id" name="salesperson_id" defaultValue={v("salesperson_id")} disabled={!canManageTerms}>
                  <option value="">Unassigned</option>{salespeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </Select>
              </Field>
              <Field label="Internal notes" name="internal_notes" className="sm:col-span-2" hint="Never shown to the customer"><Textarea id="internal_notes" name="internal_notes" rows={3} defaultValue={v("internal_notes")} /></Field>
            </FormSection>
            <div className="flex justify-end"><SubmitButton>{c.id ? "Save customer" : "Create customer"}</SubmitButton></div>
          </>
        );
      }}
    </ActionForm>
  );
}
