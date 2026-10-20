import Link from "next/link";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/ui/data";
import { Card, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatQty, humanize } from "@/lib/utils";

const STEPS = ["new", "contacted", "quotation_sent", "accepted", "converted"];

export default async function MyEnquiry({ params }: PageProps<"/portal/enquiries/[id]">) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: e }, { data: items }, { data: acts }, { data: quotes }] = await Promise.all([
    supabase.from("enquiries").select("*").eq("id", id).maybeSingle(),
    supabase.from("enquiry_items").select("id, sku_snapshot, name_snapshot, quantity").eq("enquiry_id", id),
    supabase.from("enquiry_activities").select("id, activity_type, body, to_status, created_at").eq("enquiry_id", id).order("created_at", { ascending: false }),
    supabase.from("quotations").select("id, quotation_number, status").eq("enquiry_id", id),
  ]);
  if (!e) notFound();
  const stepIdx = Math.max(0, STEPS.indexOf(e.status === "assigned" ? "new" : ["quotation_in_preparation"].includes(e.status) ? "contacted" : e.status === "awaiting_response" ? "quotation_sent" : e.status));
  return (
    <>
      <Link href="/portal/enquiries" className="text-sm text-muted hover:text-ink">← Requests</Link>
      <div className="mb-4 mt-1 flex items-center gap-2"><h1 className="text-xl font-semibold">{e.enquiry_number}</h1><StatusBadge status={e.status} /></div>
      {!["rejected", "closed"].includes(e.status) && (
        <ol className="mb-4 grid grid-cols-5 overflow-hidden rounded-lg border border-line bg-white text-center text-[11px] sm:text-xs">
          {["Submitted", "Being reviewed", "Quotation sent", "Accepted", "Order confirmed"].map((l, i) => (
            <li key={l} className={`border-r border-line px-1 py-2 last:border-0 ${i <= stepIdx ? "bg-brand-50 font-medium text-brand-600" : "text-muted"}`}>{l}</li>
          ))}
        </ol>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Requested items" />
            <ul className="divide-y divide-line text-sm">{(items ?? []).map((i) => <li key={i.id} className="flex justify-between px-4 py-2"><span>{i.name_snapshot} <span className="text-xs text-muted">{i.sku_snapshot}</span></span><span className="tnum">× {formatQty(i.quantity)}</span></li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <DescriptionList items={[["Submitted", formatDate(e.created_at)], ["Requested delivery", formatDate(e.requested_delivery_date)], ["Delivery address", e.delivery_address], ["Notes", e.notes]]} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Quotations" />
            <ul className="divide-y divide-line text-sm">
              {(quotes ?? []).map((q) => <li key={q.id} className="flex justify-between px-4 py-2"><Link href={`/portal/quotations/${q.id}`} className="text-navy hover:underline">{q.quotation_number}</Link><StatusBadge status={q.status} /></li>)}
              {!quotes?.length && <li className="px-4 py-3 text-muted">Our team is preparing your quotation.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Updates" />
            <Timeline items={(acts ?? []).map((a) => ({ id: a.id, at: a.created_at, title: a.activity_type === "status_change" ? `Status: ${humanize(a.to_status)}` : humanize(a.activity_type), body: a.body }))} />
          </Card>
        </div>
      </div>
    </>
  );
}
