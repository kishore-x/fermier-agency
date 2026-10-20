import { FileCheck2 } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { Card, EmptyState, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, pageRange } from "@/lib/utils";

export default async function PurchaseOrdersPage({ searchParams }: PageProps<"/admin/purchase-orders">) {
  await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("customer_purchase_orders").select("id, po_number, po_date, po_amount, status, created_at, is_direct, customers(company_name), quotations(quotation_number, grand_total), enquiries(enquiry_number)", { count: "exact" }).order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  const { data, count } = await q.range(from, to);
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <PageHeader title="Customer purchase orders" description="POs issued by customers — against accepted quotations, or raised directly from a product page. Verify each before confirming a sales order." />
      <Card>
        <FilterBar action="/admin/purchase-orders" resetHref="/admin/purchase-orders">
          <Select name="status" defaultValue={sp.status ?? ""} className="w-56"><option value="">Any status</option><option value="received">Received — awaiting verification</option><option value="verified">Verified</option><option value="requires_correction">Requires correction</option></Select>
        </FilterBar>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/admin/purchase-orders/${r.id}`}
          empty={<EmptyState icon={<FileCheck2 className="h-10 w-10" />} title="No customer POs yet" />}
          columns={[
            { key: "po", header: "PO number", cell: (r: R) => r.po_number },
            { key: "cust", header: "Customer", cell: (r: R) => (r.customers as unknown as { company_name: string }).company_name },
            { key: "qt", header: "Against", cell: (r: R) => {
              const qt = r.quotations as unknown as { quotation_number: string } | null;
              const enq = r.enquiries as unknown as { enquiry_number: string } | null;
              return qt ? qt.quotation_number : <span className="flex items-center gap-1.5"><StatusBadge status="new" label="Direct PO" />{enq?.enquiry_number}</span>;
            } },
            { key: "amt", header: "PO amount", align: "right", cell: (r: R) => {
              const qt = r.quotations as unknown as { grand_total: string } | null;
              return <span className={qt && Number(qt.grand_total) !== Number(r.po_amount) ? "text-amber-700" : ""}>{formatMoney(r.po_amount)}</span>;
            } },
            { key: "date", header: "PO date", cell: (r: R) => formatDate(r.po_date) },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
          ]} />
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/purchase-orders" params={sp} />
      </Card>
    </>
  );
}
