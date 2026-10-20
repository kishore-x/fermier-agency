import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, CardHeader, DescriptionList, Field, Input, Textarea } from "@/components/ui/primitives";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addMyAddress, updateMyProfile } from "../actions";

export const metadata = { title: "Profile" };

export default async function MyProfile() {
  const session = await requireCustomer();
  const supabase = await createClient();
  const [{ data: c }, { data: me }, { data: addresses }] = await Promise.all([
    supabase.from("customers").select("company_name, customer_code, gstin, primary_contact, phone, email, billing_address, state, payment_terms, profiles(full_name, email)").eq("id", session.customerId).single(),
    supabase.from("profiles").select("full_name, phone, email").eq("id", session.userId).single(),
    supabase.from("customer_addresses").select("id, label, line1, city, state, postal_code").eq("customer_id", session.customerId),
  ]);
  const sp = c?.profiles as unknown as { full_name: string; email: string } | null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Company & contact" description="GSTIN, payment terms and credit are maintained by our team — contact your salesperson to change them." />
        <DescriptionList items={[["Company", c?.company_name], ["Account code", c?.customer_code], ["GSTIN", c?.gstin ?? "Not on file"], ["Payment terms", c?.payment_terms],
          ["Your salesperson", sp ? `${sp.full_name} · ${sp.email}` : "Being assigned"]]} />
        <ActionForm action={updateMyProfile} className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
          <Field label="Your name" name="full_name"><Input id="full_name" name="full_name" defaultValue={me?.full_name} required /></Field>
          <Field label="Your phone" name="phone"><Input id="phone" name="phone" defaultValue={me?.phone ?? ""} /></Field>
          <Field label="Company primary contact" name="primary_contact"><Input id="primary_contact" name="primary_contact" defaultValue={c?.primary_contact ?? ""} /></Field>
          <Field label="Company phone" name="company_phone"><Input id="company_phone" name="company_phone" defaultValue={c?.phone ?? ""} /></Field>
          <Field label="State" name="state"><Input id="state" name="state" defaultValue={c?.state ?? ""} /></Field>
          <Field label="Billing address" name="billing_address" className="sm:col-span-2"><Textarea id="billing_address" name="billing_address" rows={2} defaultValue={c?.billing_address ?? ""} /></Field>
          <div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title="Delivery addresses" />
        <ul className="divide-y divide-line text-sm">
          {(addresses ?? []).map((a) => <li key={a.id} className="px-4 py-2"><p className="font-medium">{a.label}</p><p className="text-muted">{[a.line1, a.city, a.state, a.postal_code].filter(Boolean).join(", ")}</p></li>)}
          {!addresses?.length && <li className="px-4 py-3 text-muted">No saved delivery addresses.</li>}
        </ul>
        <ActionForm action={addMyAddress} resetOnSuccess className="grid grid-cols-2 gap-2 border-t border-line p-4">
          <Input name="label" placeholder="Label (e.g. Site 2)" aria-label="Label" />
          <Input name="city" placeholder="City" aria-label="City" />
          <Input name="line1" placeholder="Address" aria-label="Address" className="col-span-2" required />
          <Input name="state" placeholder="State" aria-label="State" />
          <Input name="postal_code" placeholder="PIN code" aria-label="PIN code" />
          <SubmitButton variant="outline" className="col-span-2">Add address</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
