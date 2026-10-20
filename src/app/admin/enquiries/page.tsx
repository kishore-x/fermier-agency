import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { getSalespeople } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, humanize, pageRange, searchTerm } from "@/lib/utils";

const STATUSES = ["new", "assigned", "contacted", "quotation_in_preparation", "quotation_sent", "awaiting_response", "accepted", "rejected", "converted", "closed"];

export default async function EnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("enquiries").select("id, enquiry_number, status, source, contact_name, created_at, next_follow_up_at, customers(company_name), profiles!enquiries_assigned_to_fkey(full_name), enquiry_items(count)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.assigned === "me") q = q.eq("assigned_to", session.userId);
  else if (sp.assigned === "none") q = q.is("assigned_to", null);
  else if (sp.assigned) q = q.eq("assigned_to", sp.assigned);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`enquiry_number.ilike.%${term}%,contact_name.ilike.%${term}%`);
  const [{ data, count }, staff, { data: counts }] = await Promise.all([q.range(from, to), getSalespeople(), supabase.from("enquiries").select("status")]);
  const byStatus = (counts ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <PageHeader title="Enquiries" description="Order requests from the portal and enquiries from the website, through to quotation." />
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/admin/enquiries" className={`rounded-full border px-3 py-1 text-xs ${!sp.status ? "border-navy bg-navy text-white" : "border-line bg-white"}`}>All</Link>
        {STATUSES.filter((s) => byStatus[s]).map((s) => (
          <Link key={s} href={`/admin/enquiries?status=${s}`} className={`rounded-full border px-3 py-1 text-xs ${sp.status === s ? "border-navy bg-navy text-white" : "border-line bg-white"}`}>{humanize(s)} <span className="opacity-70">{byStatus[s]}</span></Link>
        ))}
      </div>
      <Card>
        <FilterBar action="/admin/enquiries" resetHref="/admin/enquiries">
          <Input name="q" defaultValue={sp.q} placeholder="Reference or contact" className="w-56" />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-48"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
          <Select name="assigned" defaultValue={sp.assigned ?? ""} className="w-48"><option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</Select>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/admin/enquiries/${r.id}`}
          empty={<EmptyState icon={<ClipboardList className="h-10 w-10" />} title="No enquiries" description="Customer order requests and website enquiries appear here." />}
          columns={[
            { key: "ref", header: "Reference", cell: (r: R) => r.enquiry_number },
            { key: "cust", header: "Customer / contact", cell: (r: R) => (r.customers as unknown as { company_name: string } | null)?.company_name ?? <span>{r.contact_name} <span className="text-xs text-muted">(not linked)</span></span> },
            { key: "src", header: "Source", cell: (r: R) => humanize(r.source) },
            { key: "items", header: "Items", align: "right", cell: (r: R) => (r.enquiry_items as unknown as { count: number }[])[0]?.count ?? 0 },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
            { key: "owner", header: "Assigned", cell: (r: R) => (r.profiles as unknown as { full_name: string } | null)?.full_name ?? <span className="text-amber-700">Unassigned</span> },
            { key: "fu", header: "Follow-up", cell: (r: R) => r.next_follow_up_at ? <span className={new Date(r.next_follow_up_at) < new Date() ? "text-danger" : ""}>{formatDateTime(r.next_follow_up_at)}</span> : "—" },
            { key: "at", header: "Received", cell: (r: R) => <span className="text-muted">{formatDate(r.created_at)}</span> },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/enquiries" params={sp} />
      </Card>
    </>
  );
}
