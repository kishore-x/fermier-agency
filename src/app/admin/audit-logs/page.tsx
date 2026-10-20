import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, pageRange, searchTerm } from "@/lib/utils";

const ENTITIES = ["product", "sales_order", "quotation", "customer_purchase_order", "user", "integration", "company_settings"];

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  await requireStaff("super_admin");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page), 50);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, entity_type, entity_id, before_data, after_data, created_at, profiles(full_name, email)", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.entity) q = q.eq("entity_type", sp.entity);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("action", `%${term}%`);
  const { data, count } = await q.range(from, to);
  type R = NonNullable<typeof data>[number];
  const diff = (b: unknown, a: unknown) => {
    const before = (b ?? {}) as Record<string, unknown>, after = (a ?? {}) as Record<string, unknown>;
    return Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) && !["updated_at"].includes(k)).slice(0, 6)
      .map((k) => <div key={k} className="font-mono text-[11px]"><span className="text-muted">{k}:</span> {b ? <><span className="text-danger line-through">{JSON.stringify(before[k]) ?? "∅"}</span> → </> : null}<span className="text-brand-600">{JSON.stringify(after[k]) ?? "∅"}</span></div>);
  };
  return (
    <>
      <PageHeader title="Audit log" description="Price changes, stock adjustments, reservations, approvals, order confirmations, cancellations, invoicing, integration and role changes." />
      <Card>
        <FilterBar action="/admin/audit-logs" resetHref="/admin/audit-logs">
          <Input name="q" defaultValue={sp.q} placeholder="Action contains…" className="w-56" />
          <Select name="entity" defaultValue={sp.entity ?? ""} className="w-56"><option value="">All records</option>{ENTITIES.map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}</Select>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => String(r.id)} empty={<EmptyState title="No audit entries" />}
          columns={[
            { key: "at", header: "When", cell: (r: R) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</span> },
            { key: "who", header: "Actor", cell: (r: R) => { const p = r.profiles as unknown as { full_name: string; email: string } | null; return p ? p.full_name || p.email : <span className="text-muted">System</span>; } },
            { key: "action", header: "Action", cell: (r: R) => <span className="font-mono text-xs">{r.action}</span> },
            { key: "target", header: "Record", cell: (r: R) => <span className="text-xs">{r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</span> },
            { key: "changes", header: "Changes", cell: (r: R) => diff(r.before_data, r.after_data) },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={50} basePath="/admin/audit-logs" params={sp} />
      </Card>
    </>
  );
}
