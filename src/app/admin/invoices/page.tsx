import Link from "next/link";
import { ExternalLink, Receipt } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { ConfirmAction } from "@/components/ui/forms";
import { Alert, Card, EmptyState, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/zoho/jobs";
import { formatDate, formatDateTime, formatMoney, pageRange } from "@/lib/utils";
import { retryIntegrationJob } from "../integrations/actions";

export default async function InvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("invoices").select("id, sales_order_id, is_mock, external_invoice_number, external_url, external_status, sync_status, total, balance_due, due_date, last_synced_at, customers(company_name), sales_orders(order_number)", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.status) q = q.eq("sync_status", sp.status);
  if (sp.filter === "overdue") q = q.in("sync_status", ["created", "mock"]).gt("balance_due", 0).lt("due_date", new Date().toISOString().slice(0, 10));
  const [{ data, count }, conn, { data: jobs }] = await Promise.all([q.range(from, to), getConnection(), supabase.from("integration_jobs").select("id, entity_id, status")]);
  const jobFor = new Map((jobs ?? []).map((j) => [j.entity_id, j]));
  type R = NonNullable<typeof data>[number];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Invoices" description="Invoice references from Zoho Books. Payment data shown only once synchronised — never assumed." />
      {conn.mode === "mock" && <Alert tone="info" className="mb-4">Zoho Books is in <strong>mock mode</strong>. Invoices labelled “Simulated” were generated locally for the demo and do not exist in Zoho Books. <Link href="/admin/integrations" className="underline">Configure</Link></Alert>}
      <Card>
        <FilterBar action="/admin/invoices" resetHref="/admin/invoices">
          <Select name="status" defaultValue={sp.status ?? ""} className="w-48"><option value="">Any sync status</option><option value="pending">Pending creation</option><option value="created">Created in Zoho</option><option value="mock">Simulated</option><option value="failed">Failed</option></Select>
          <Select name="filter" defaultValue={sp.filter ?? ""} className="w-40"><option value="">All</option><option value="overdue">Overdue</option></Select>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id}
          empty={<EmptyState icon={<Receipt className="h-10 w-10" />} title="No invoices yet" description="Invoices are created from confirmed or dispatched sales orders." />}
          columns={[
            { key: "num", header: "Invoice", cell: (r: R) => r.external_invoice_number ? <span className="font-medium">{r.external_invoice_number}</span> : <span className="text-muted">Not created</span> },
            { key: "so", header: "Order", cell: (r: R) => <Link href={`/admin/sales-orders/${r.sales_order_id}`} className="text-navy hover:underline">{(r.sales_orders as unknown as { order_number: string }).order_number}</Link> },
            { key: "cust", header: "Customer", cell: (r: R) => (r.customers as unknown as { company_name: string }).company_name },
            { key: "sync", header: "Sync", cell: (r: R) => <StatusBadge status={r.is_mock ? "mock" : r.sync_status} label={r.is_mock ? "Simulated" : undefined} /> },
            { key: "zs", header: "Zoho status", cell: (r: R) => r.is_mock ? <span className="text-muted">n/a</span> : r.external_status ?? <span className="text-muted">Unsynchronised</span> },
            { key: "total", header: "Total", align: "right", cell: (r: R) => formatMoney(r.total) },
            { key: "bal", header: "Balance", align: "right", cell: (r: R) => r.sync_status === "created" || r.is_mock ? formatMoney(r.balance_due) : <span className="text-muted">Unsynchronised</span> },
            { key: "due", header: "Due", cell: (r: R) => <span className={r.due_date && r.due_date < today && Number(r.balance_due) > 0 ? "font-medium text-danger" : ""}>{formatDate(r.due_date)}</span> },
            { key: "synced", header: "Last synced", cell: (r: R) => <span className="text-xs text-muted">{formatDateTime(r.last_synced_at)}</span> },
            { key: "act", header: "", align: "right", cell: (r: R) => {
              const j = jobFor.get(r.sales_order_id);
              if (r.external_url && !r.is_mock) return <Link href={r.external_url} target="_blank" className="inline-flex items-center gap-1 text-sm text-navy hover:underline">Zoho <ExternalLink className="h-3 w-3" /></Link>;
              if (j && ["failed", "pending"].includes(j.status)) return <ConfirmAction action={retryIntegrationJob} fields={{ job_id: j.id }} trigger="Retry" title="Retry invoice creation?" confirmLabel="Retry" />;
              return null;
            } },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/invoices" params={sp} />
      </Card>
    </>
  );
}
