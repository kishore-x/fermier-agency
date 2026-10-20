import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Timeline } from "@/components/ui/data";
import { Alert, Card, CardHeader, DescriptionList, Field, Input, LinkButton, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { getSalespeople } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatQty, humanize } from "@/lib/utils";
import { linkEnquiryCustomer, logEnquiryActivity, updateEnquiry } from "../actions";

const STATUSES = ["new", "assigned", "contacted", "quotation_in_preparation", "quotation_sent", "awaiting_response", "accepted", "rejected", "converted", "closed"];

export default async function EnquiryDetail({ params }: PageProps<"/admin/enquiries/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: e }, { data: items }, { data: acts }, { data: quotes }, staff, { data: customers }] = await Promise.all([
    supabase.from("enquiries").select("*, customers(id, company_name, customer_code)").eq("id", id).maybeSingle(),
    supabase.from("enquiry_items").select("id, sku_snapshot, name_snapshot, quantity, product_id, products(selling_price, price_visibility, inventory_balances(on_hand, reserved))").eq("enquiry_id", id),
    supabase.from("enquiry_activities").select("id, activity_type, body, from_status, to_status, is_internal, created_at, profiles(full_name)").eq("enquiry_id", id).order("created_at", { ascending: false }),
    supabase.from("quotations").select("id, quotation_number, status, revision").eq("enquiry_id", id),
    getSalespeople(),
    supabase.from("customers").select("id, company_name").eq("status", "active").order("company_name").limit(500),
  ]);
  if (!e) notFound();
  const cust = e.customers as { id: string; company_name: string; customer_code: string } | null;
  const sell = can.sell(session);
  const toLocal = (d: string | null) => d ? new Date(new Date(d).getTime() + 5.5 * 3600e3).toISOString().slice(0, 16) : "";

  return (
    <>
      <PageHeader back={{ href: "/admin/enquiries", label: "Enquiries" }}
        title={<span className="flex items-center gap-2">{e.enquiry_number} <StatusBadge status={e.status} /></span>}
        description={`${humanize(e.source)} · received ${formatDate(e.created_at)}`}
        actions={sell && cust && !["converted", "closed"].includes(e.status) && (
          <LinkButton href={`/admin/quotations/new?enquiry=${e.id}`} variant="success"><FilePlus2 className="h-4 w-4" />Create quotation</LinkButton>
        )} />
      {!cust && <Alert tone="warn" className="mb-4">This enquiry isn&apos;t linked to a customer yet. Link or create the customer before preparing a quotation.</Alert>}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Request" />
            <DescriptionList cols={3} items={[
              ["Customer", cust ? <Link href={`/admin/customers/${cust.id}`} className="text-navy hover:underline">{cust.company_name}</Link> : "Not linked"],
              ["Contact", [e.contact_name, e.contact_phone].filter(Boolean).join(" · ")], ["Email", e.contact_email],
              ["Delivery address", e.delivery_address], ["Requested delivery", formatDate(e.requested_delivery_date)], ["Notes", e.notes],
            ]} />
          </Card>
          <Card>
            <CardHeader title={`Requested items (${items?.length ?? 0})`} />
            {items?.length ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Available now</th></tr></thead>
                <tbody>{items.map((it) => {
                  const bal = (it.products as unknown as { inventory_balances: { on_hand: string; reserved: string }[] } | null)?.inventory_balances ?? [];
                  const avail = bal.reduce((a, b) => a + Number(b.on_hand) - Number(b.reserved), 0);
                  return (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2"><p className="font-medium">{it.name_snapshot}</p><p className="text-xs text-muted">{it.sku_snapshot}</p></td>
                      <td className="px-4 py-2 text-right tnum">{formatQty(it.quantity)}</td>
                      <td className={`px-4 py-2 text-right tnum ${avail < Number(it.quantity) ? "text-amber-700" : "text-ok-600"}`}>{formatQty(avail)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : <p className="p-4 text-sm text-muted">General enquiry — no specific products. See notes.</p>}
          </Card>
          <Card>
            <CardHeader title="Activity" description="Status changes, calls, notes and follow-ups" />
            {sell && (
              <ActionForm action={logEnquiryActivity} resetOnSuccess className="grid gap-2 border-b border-line p-3 sm:grid-cols-[130px_1fr_auto]">
                <input type="hidden" name="enquiry_id" value={e.id} />
                <Select name="activity_type" aria-label="Activity type"><option value="call">Call</option><option value="note">Note</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option></Select>
                <Input name="body" placeholder="Summary of the conversation, next step…" required />
                <SubmitButton>Log</SubmitButton>
                <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3"><input type="checkbox" name="share" /> Visible to customer in their portal</label>
              </ActionForm>
            )}
            <Timeline items={(acts ?? []).map((a) => ({
              id: a.id, at: a.created_at, actor: (a.profiles as unknown as { full_name: string } | null)?.full_name,
              tone: a.activity_type === "status_change" ? "success" : "default",
              title: a.activity_type === "status_change" ? <>Status {a.from_status ? <><StatusBadge status={a.from_status} /> → </> : ""}<StatusBadge status={a.to_status} /></>
                : <>{humanize(a.activity_type)}{a.is_internal && <span className="ml-2 text-xs text-muted">(internal)</span>}</>,
              body: a.body,
            }))} />
          </Card>
        </div>

        <div className="space-y-4">
          {sell && (
            <Card>
              <CardHeader title="Manage" />
              <ActionForm action={updateEnquiry} className="space-y-3 p-4">
                <input type="hidden" name="id" value={e.id} />
                <Field label="Status" name="status"><Select id="status" name="status" defaultValue={e.status}>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
                <Field label="Assigned salesperson" name="assigned_to" hint={can.approve(session) ? undefined : "Only managers can reassign"}>
                  <Select id="assigned_to" name="assigned_to" defaultValue={e.assigned_to ?? ""}>
                    <option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </Select>
                </Field>
                <Field label="Next follow-up" name="next_follow_up_at"><Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" defaultValue={toLocal(e.next_follow_up_at)} /></Field>
                <Field label="Comment" name="note"><Textarea id="note" name="note" rows={2} placeholder="Reason for status change (shown on the trail)" /></Field>
                <SubmitButton className="w-full">Update</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {!cust && sell && (
            <Card>
              <CardHeader title="Link customer" />
              <ActionForm action={linkEnquiryCustomer} className="space-y-2 p-4">
                <input type="hidden" name="enquiry_id" value={e.id} />
                <Select name="customer_id" required aria-label="Customer" defaultValue=""><option value="" disabled>Choose customer…</option>{(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select>
                <SubmitButton className="w-full" variant="outline">Link</SubmitButton>
                <Link href="/admin/customers/new" className="block text-center text-xs text-navy hover:underline">or create a new customer</Link>
              </ActionForm>
            </Card>
          )}
          <Card>
            <CardHeader title="Quotations" />
            <ul className="divide-y divide-line text-sm">
              {(quotes ?? []).map((q) => <li key={q.id} className="flex items-center justify-between px-4 py-2"><Link href={`/admin/quotations/${q.id}`} className="text-navy hover:underline">{q.quotation_number}{q.revision > 1 && ` rev ${q.revision}`}</Link><StatusBadge status={q.status} /></li>)}
              {!quotes?.length && <li className="px-4 py-3 text-muted">No quotation yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
