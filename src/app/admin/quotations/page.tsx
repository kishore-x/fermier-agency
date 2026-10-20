import { FileText, Plus } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanize, pageRange, searchTerm } from "@/lib/utils";

const STATUSES = ["draft", "pending_approval", "approved", "sent", "accepted", "rejected", "expired", "converted"];

export default async function QuotationsPage({ searchParams }: PageProps<"/admin/quotations">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("quotations").select("id, quotation_number, revision, status, grand_total, quotation_date, expiry_date, requires_approval, customers(company_name), profiles!quotations_created_by_fkey(full_name)", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.mine) q = q.eq("created_by", session.userId);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("quotation_number", `%${term}%`);
  const { data, count } = await q.range(from, to);
  type R = NonNullable<typeof data>[number];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Quotations" actions={can.sell(session) && <LinkButton href="/admin/quotations/new"><Plus className="h-4 w-4" />New quotation</LinkButton>} />
      <Card>
        <FilterBar action="/admin/quotations" resetHref="/admin/quotations">
          <Input name="q" defaultValue={sp.q} placeholder="Quotation number" className="w-48" />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-48"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> Created by me</label>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/admin/quotations/${r.id}`}
          empty={<EmptyState icon={<FileText className="h-10 w-10" />} title="No quotations" description="Create one from an enquiry or a customer record." />}
          columns={[
            { key: "num", header: "Number", cell: (r: R) => `${r.quotation_number}${r.revision > 1 ? ` · rev ${r.revision}` : ""}` },
            { key: "cust", header: "Customer", cell: (r: R) => (r.customers as unknown as { company_name: string }).company_name },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
            { key: "total", header: "Grand total", align: "right", cell: (r: R) => formatMoney(r.grand_total) },
            { key: "date", header: "Date", cell: (r: R) => formatDate(r.quotation_date) },
            { key: "exp", header: "Valid until", cell: (r: R) => <span className={["sent", "approved"].includes(r.status) && r.expiry_date < today ? "text-danger" : ""}>{formatDate(r.expiry_date)}</span> },
            { key: "by", header: "Prepared by", cell: (r: R) => (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—" },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/quotations" params={sp} />
      </Card>
    </>
  );
}
