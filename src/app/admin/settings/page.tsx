import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, FormSection, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "../system-actions";

export default async function SettingsPage() {
  const session = await requireStaff("admin");
  const supabase = await createClient();
  const { data: s } = await supabase.from("company_settings").select("*").single();
  if (!s) return null;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" description="Company profile used on quotations, the public site and notifications." />
      <ActionForm action={saveSettings} className="space-y-4">
        <FormSection title="Company profile" description="Shown on quotation PDFs and the website footer">
          <Field label="Trading name" name="company_name" required><Input id="company_name" name="company_name" defaultValue={s.company_name} required /></Field>
          <Field label="Legal name" name="legal_name"><Input id="legal_name" name="legal_name" defaultValue={s.legal_name ?? ""} /></Field>
          <Field label="Address" name="address" className="sm:col-span-2"><Textarea id="address" name="address" rows={2} defaultValue={s.address ?? ""} /></Field>
          <Field label="Phone" name="phone"><Input id="phone" name="phone" defaultValue={s.phone ?? ""} /></Field>
          <Field label="Email" name="email"><Input id="email" name="email" type="email" defaultValue={s.email ?? ""} /></Field>
          <Field label="WhatsApp number" name="whatsapp_number" hint="Digits with country code, e.g. 919876543210"><Input id="whatsapp_number" name="whatsapp_number" defaultValue={s.whatsapp_number ?? ""} /></Field>
          <Field label="GSTIN" name="gstin"><Input id="gstin" name="gstin" defaultValue={s.gstin ?? ""} maxLength={15} /></Field>
        </FormSection>
        <FormSection title="Quotations & approvals">
          <Field label="Default validity (days)" name="quotation_validity_days"><Input id="quotation_validity_days" name="quotation_validity_days" defaultValue={s.quotation_validity_days} inputMode="numeric" /></Field>
          <Field label="Approval needed above discount %" name="approval_discount_pct" hint="Unless the user's personal limit is higher"><Input id="approval_discount_pct" name="approval_discount_pct" defaultValue={Number(s.approval_discount_pct)} inputMode="decimal" /></Field>
          <Field label="Approval needed above quotation value (₹)" name="approval_amount_threshold"><Input id="approval_amount_threshold" name="approval_amount_threshold" defaultValue={Number(s.approval_amount_threshold)} inputMode="decimal" /></Field>
          <Field label="Default terms & conditions" name="default_terms" className="sm:col-span-2"><Textarea id="default_terms" name="default_terms" rows={6} defaultValue={s.default_terms ?? ""} /></Field>
        </FormSection>
        <FormSection title="Fulfilment & invoicing">
          <Field label="Create invoice" name="invoice_stage">
            <Select id="invoice_stage" name="invoice_stage" defaultValue={s.invoice_stage}><option value="on_dispatch">When goods are dispatched</option><option value="on_confirmation">When the sales order is confirmed</option></Select>
          </Field>
          <label className="flex items-start gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="allow_negative_stock" defaultChecked={s.allow_negative_stock} disabled={!session.roles.includes("super_admin")} className="mt-0.5 h-4 w-4" />
            <span>Allow negative stock<span className="block text-xs text-muted">Super Admin only. Not recommended — allows overselling.</span></span>
          </label>
          {!session.roles.includes("super_admin") && s.allow_negative_stock && <input type="hidden" name="allow_negative_stock" value="on" />}
        </FormSection>
        <div className="flex justify-end"><SubmitButton>Save settings</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
