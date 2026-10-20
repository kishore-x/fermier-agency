import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Timeline } from "@/components/ui/data";
import { Card, CardHeader, DescriptionList, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { getSalespeople } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanize } from "@/lib/utils";
import { addAddress, addCustomerNote, createPortalUser } from "../actions";
import { CustomerForm } from "../customer-form";

export default async function CustomerDetail({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const { tab = "overview" } = (await searchParams) as { tab?: string };
  const supabase = await createClient();
  const [{ data: c }, { data: addresses }, { data: activities }, { data: quotes }, { data: orders }, { data: invoices }, { data: enquiries }, { data: pos }, { data: users }] = await Promise.all([
    supabase.from("customers").select("*, profiles(full_name)").eq("id", id).maybeSingle(),
    supabase.from("customer_addresses").select("*").eq("customer_id", id),
    supabase.from("customer_activities").select("id, activity_type, summary, reference_type, reference_id, created_at, profiles(full_name)").eq("customer_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("quotations").select("id, quotation_number, revision, status, grand_total, quotation_date").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("sales_orders").select("id, order_number, status, grand_total, order_date").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, external_invoice_number, is_mock, sync_status, total, balance_due, due_date, sales_orders(order_number)").eq("customer_id", id),
    supabase.from("enquiries").select("id, enquiry_number, status, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("customer_purchase_orders").select("id, po_number, po_date, po_amount, status, file_name").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("customer_users").select("user_id, profiles(full_name, email)").eq("customer_id", id),
  ]);
  if (!c) notFound();
  const sp = c.profiles as { full_name: string } | null;
  const tabs = [["overview", "Overview & timeline"], ["edit", "Edit details"], ["documents", "Quotes, orders & invoices"]];
  const linkFor = (t: string | null, rid: string | null) =>
    !rid ? null : ({ quotation: `/admin/quotations/${rid}`, sales_order: `/admin/sales-orders/${rid}`, enquiry: `/admin/enquiries/${rid}`, customer_purchase_order: `/admin/purchase-orders/${rid}` } as Record<string, string>)[t ?? ""];

  return (
    <>
      <PageHeader back={{ href: "/admin/customers", label: "Customers" }}
        title={<span className="flex items-center gap-2">{c.company_name} <StatusBadge status={c.status} />{c.is_sample_data && <StatusBadge status="mock" label="Sample data" />}</span>}
        description={`${c.customer_code} · ${humanize(c.customer_type)} · ${sp?.full_name ?? "No salesperson assigned"}`}
        actions={can.sell(session) && <LinkButton href={`/admin/quotations/new?customer=${c.id}`}><FilePlus2 className="h-4 w-4" />New quotation</LinkButton>} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-navy font-medium text-navy" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>)}
      </div>

      {tab === "edit" && <div className="max-w-4xl"><CustomerForm c={c} salespeople={await getSalespeople()} canManageTerms={can.approve(session)} /></div>}

      {tab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Details" />
              <DescriptionList cols={3} items={[
                ["Primary contact", c.primary_contact], ["Email", c.email], ["Phone", c.phone], ["GSTIN", c.gstin ?? "Not provided"],
                ["State / country", [c.state, c.country].filter(Boolean).join(", ")], ["Payment terms", c.payment_terms],
                ["Credit limit", c.credit_limit ? formatMoney(c.credit_limit) : "None"], ["Billing address", c.billing_address],
                ["Internal notes", c.internal_notes],
              ]} />
            </Card>
            <Card>
              <CardHeader title="Interaction timeline" description="Enquiries, quotations, POs, orders, dispatches, calls and notes" />
              {can.sell(session) && (
                <ActionForm action={addCustomerNote} resetOnSuccess className="flex flex-wrap gap-2 border-b border-line p-3">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Select name="activity_type" aria-label="Activity type" className="w-32"><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option><option value="visit">Site visit</option><option value="note">Note</option></Select>
                  <Input name="summary" placeholder="What happened? Next step?" className="min-w-60 flex-1" required />
                  <SubmitButton>Log</SubmitButton>
                </ActionForm>
              )}
              <Timeline items={(activities ?? []).map((a) => {
                const href = linkFor(a.reference_type, a.reference_id);
                return {
                  id: a.id, at: a.created_at, actor: (a.profiles as unknown as { full_name: string } | null)?.full_name,
                  title: <><StatusBadge status={a.activity_type} label={humanize(a.activity_type)} className="mr-2" />{href ? <Link href={href} className="text-navy hover:underline">{a.summary}</Link> : a.summary}</>,
                };
              })} />
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Delivery addresses" />
              <ul className="divide-y divide-line text-sm">
                {(addresses ?? []).map((a) => <li key={a.id} className="px-4 py-2"><p className="font-medium">{a.label}{a.is_default && " (default)"}</p><p className="text-muted">{[a.line1, a.city, a.state, a.postal_code].filter(Boolean).join(", ")}</p></li>)}
                {!addresses?.length && <li className="px-4 py-3 text-muted">No delivery addresses.</li>}
              </ul>
              {can.sell(session) && (
                <ActionForm action={addAddress} resetOnSuccess className="grid grid-cols-2 gap-2 border-t border-line p-3">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Input name="label" placeholder="Label (e.g. Site 2)" aria-label="Label" />
                  <Input name="city" placeholder="City" aria-label="City" />
                  <Input name="line1" placeholder="Address" aria-label="Address" className="col-span-2" required />
                  <Input name="state" placeholder="State" aria-label="State" />
                  <Input name="postal_code" placeholder="PIN" aria-label="PIN code" />
                  <SubmitButton size="sm" variant="outline" className="col-span-2">Add address</SubmitButton>
                </ActionForm>
              )}
            </Card>
            <Card>
              <CardHeader title="Portal logins" />
              <ul className="divide-y divide-line text-sm">
                {(users ?? []).map((u) => { const p = u.profiles as unknown as { full_name: string; email: string }; return <li key={u.user_id} className="px-4 py-2">{p.full_name}<p className="text-xs text-muted">{p.email}</p></li>; })}
                {!users?.length && <li className="px-4 py-3 text-muted">No portal users yet.</li>}
              </ul>
              {can.approve(session) && (
                <ActionForm action={createPortalUser} resetOnSuccess className="space-y-2 border-t border-line p-3">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Field label="Contact name" name="full_name"><Input id="full_name" name="full_name" required /></Field>
                  <Field label="Email" name="email"><Input id="email" name="email" type="email" required /></Field>
                  <Field label="Temporary password" name="password" hint="Min 8 chars — share securely, ask them to change it"><Input id="password" name="password" type="text" minLength={8} required autoComplete="off" /></Field>
                  <SubmitButton size="sm" variant="outline" className="w-full">Create portal login</SubmitButton>
                </ActionForm>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DocList title="Enquiries / order requests" rows={(enquiries ?? []).map((e) => ({ id: e.id, href: `/admin/enquiries/${e.id}`, label: e.enquiry_number, status: e.status, date: e.created_at }))} />
          <DocList title="Quotations" rows={(quotes ?? []).map((q) => ({ id: q.id, href: `/admin/quotations/${q.id}`, label: `${q.quotation_number}${q.revision > 1 ? ` rev ${q.revision}` : ""}`, status: q.status, date: q.quotation_date, amount: q.grand_total }))} />
          <DocList title="Customer purchase orders" rows={(pos ?? []).map((p) => ({ id: p.id, href: `/admin/purchase-orders/${p.id}`, label: p.po_number, status: p.status, date: p.po_date, amount: p.po_amount }))} />
          <DocList title="Sales orders" rows={(orders ?? []).map((o) => ({ id: o.id, href: `/admin/sales-orders/${o.id}`, label: o.order_number, status: o.status, date: o.order_date, amount: o.grand_total }))} />
          <DocList title="Invoices" rows={(invoices ?? []).map((i) => ({ id: i.id, href: `/admin/invoices?id=${i.id}`, label: `${i.external_invoice_number ?? "Pending"}${i.is_mock ? " (simulated)" : ""} · ${(i.sales_orders as unknown as { order_number: string }).order_number}`, status: i.is_mock ? "mock" : i.sync_status, date: i.due_date, amount: i.total }))} />
        </div>
      )}
    </>
  );
}

function DocList({ title, rows }: { title: string; rows: { id: string; href: string; label: string; status: string; date: string | null; amount?: string | null }[] }) {
  return (
    <Card>
      <CardHeader title={`${title} (${rows.length})`} />
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2">
            <Link href={r.href} className="flex-1 font-medium text-navy hover:underline">{r.label}</Link>
            <StatusBadge status={r.status} />
            {r.amount !== undefined && <span className="w-28 text-right tnum">{formatMoney(r.amount)}</span>}
            <span className="w-24 text-right text-xs text-muted">{formatDate(r.date)}</span>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-3 text-muted">None yet.</li>}
      </ul>
    </Card>
  );
}
