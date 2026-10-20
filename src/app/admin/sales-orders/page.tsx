import { ShoppingBag } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanize, pageRange, searchTerm } from "@/lib/utils";

const ORDER_STATUSES = ["confirmed", "stock_reserved", "partially_fulfilled", "ready_for_dispatch", "dispatched", "delivered", "completed", "cancelled"];

export default async function SalesOrdersPage({ searchParams }: PageProps<"/admin/sales-orders">) {
  await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("sales_orders").select("id, order_number, status, grand_total, order_date, requested_delivery_date, customers(company_name), quotations(quotation_number), invoices(sync_status, is_mock, external_invoice_number)", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("order_number", `%${term}%`);
  const { data, count } = await q.range(from, to);
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <PageHeader title="Sales orders" description="Confirmed orders retain the accepted quotation's prices and terms." />
      <Card>
        <FilterBar action="/admin/sales-orders" resetHref="/admin/sales-orders">
          <Input name="q" defaultValue={sp.q} placeholder="Order number" className="w-44" />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-48"><option value="">Any status</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/admin/sales-orders/${r.id}`}
          empty={<EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="No sales orders" description="Orders are created from accepted quotations with a verified customer PO." />}
          columns={[
            { key: "num", header: "Order", cell: (r: R) => r.order_number },
            { key: "cust", header: "Customer", cell: (r: R) => (r.customers as unknown as { company_name: string }).company_name },
            { key: "qt", header: "Quotation", cell: (r: R) => (r.quotations as unknown as { quotation_number: string }).quotation_number },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
            { key: "total", header: "Total", align: "right", cell: (r: R) => formatMoney(r.grand_total) },
            { key: "inv", header: "Invoice", cell: (r: R) => { const i = (r.invoices as unknown as { sync_status: string; is_mock: boolean; external_invoice_number: string | null }[])[0];
              return i ? <StatusBadge status={i.is_mock ? "mock" : i.sync_status} label={i.external_invoice_number ? `${i.external_invoice_number}${i.is_mock ? " (sim)" : ""}` : humanize(i.sync_status)} /> : <span className="text-muted">—</span>; } },
            { key: "date", header: "Ordered", cell: (r: R) => formatDate(r.order_date) },
            { key: "req", header: "Requested by", cell: (r: R) => formatDate(r.requested_delivery_date) },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/sales-orders" params={sp} />
      </Card>
    </>
  );
}
