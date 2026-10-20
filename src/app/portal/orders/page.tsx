import { ShoppingBag } from "lucide-react";
import { DataTable } from "@/components/ui/data";
import { Card, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "My orders" };

export default async function MyOrders() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("sales_orders").select("id, order_number, status, grand_total, order_date, requested_delivery_date, customer_purchase_orders(po_number)").order("created_at", { ascending: false });
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Orders</h1>
      <Card>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/portal/orders/${r.id}`}
          empty={<EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="No confirmed orders yet" description="Orders appear once a quotation is accepted and your PO is verified." />}
          columns={[
            { key: "num", header: "Order", cell: (r: R) => r.order_number },
            { key: "po", header: "Your PO", cell: (r: R) => (r.customer_purchase_orders as unknown as { po_number: string } | null)?.po_number ?? "—" },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
            { key: "total", header: "Total", align: "right", cell: (r: R) => formatMoney(r.grand_total) },
            { key: "date", header: "Ordered", cell: (r: R) => formatDate(r.order_date) },
          ]} />
      </Card>
    </>
  );
}
