import { Building2, Plus } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize, pageRange, searchTerm } from "@/lib/utils";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("customers").select("id, customer_code, company_name, customer_type, primary_contact, phone, state, status, created_at, is_sample_data, profiles(full_name)", { count: "exact" }).order("company_name");
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`company_name.ilike.%${term}%,customer_code.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,gstin.ilike.%${term}%`);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.mine) q = q.eq("salesperson_id", session.userId);
  const { data, count } = await q.range(from, to);
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <PageHeader title="Customers" actions={can.sell(session) && <LinkButton href="/admin/customers/new"><Plus className="h-4 w-4" />New customer</LinkButton>} />
      <Card>
        <FilterBar action="/admin/customers" resetHref="/admin/customers">
          <Input name="q" defaultValue={sp.q} placeholder="Name, code, email, phone, GSTIN" className="w-72" />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-36"><option value="">Any status</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="inactive">Inactive</option></Select>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> My customers</label>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/admin/customers/${r.id}`}
          empty={<EmptyState icon={<Building2 className="h-10 w-10" />} title="No customers found" />}
          columns={[
            { key: "name", header: "Company", cell: (r: R) => r.company_name },
            { key: "code", header: "Code", cell: (r: R) => <span className="font-mono text-xs">{r.customer_code}</span> },
            { key: "type", header: "Type", cell: (r: R) => humanize(r.customer_type) },
            { key: "contact", header: "Contact", cell: (r: R) => <div>{r.primary_contact}<p className="text-xs text-muted">{r.phone}</p></div> },
            { key: "state", header: "State", cell: (r: R) => r.state ?? "—" },
            { key: "sp", header: "Salesperson", cell: (r: R) => (r.profiles as unknown as { full_name: string } | null)?.full_name ?? <span className="text-muted">Unassigned</span> },
            { key: "status", header: "Status", cell: (r: R) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.is_sample_data && <StatusBadge status="mock" label="Sample" />}</span> },
            { key: "since", header: "Since", cell: (r: R) => <span className="text-muted">{formatDate(r.created_at)}</span> },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/customers" params={sp} />
      </Card>
    </>
  );
}
