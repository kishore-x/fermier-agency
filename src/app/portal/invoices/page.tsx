import Link from "next/link";
import { ExternalLink, Receipt } from "lucide-react";
import { DataTable } from "@/components/ui/data";
import { Card, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, humanize } from "@/lib/utils";

export const metadata = { title: "My invoices" };

export default async function MyInvoices() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("id, sales_order_id, external_invoice_number, external_url, is_mock, sync_status, external_status, total, balance_due, due_date, sales_orders(order_number)")
    .in("sync_status", ["created", "mock"]).order("due_date", { ascending: false });
  type R = NonNullable<typeof data>[number];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Invoices</h1>
      <p className="mb-4 text-sm text-muted">Balances reflect the last synchronisation with our accounting system.</p>
      <Card>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id}
          empty={<EmptyState icon={<Receipt className="h-10 w-10" />} title="No invoices yet" />}
          columns={[
            { key: "num", header: "Invoice", cell: (r: R) => <span className="font-medium">{r.external_invoice_number}{r.is_mock && <StatusBadge status="mock" label="Simulated" className="ml-2" />}</span> },
            { key: "so", header: "Order", cell: (r: R) => <Link href={`/portal/orders/${r.sales_order_id}`} className="text-navy hover:underline">{(r.sales_orders as unknown as { order_number: string }).order_number}</Link> },
            { key: "total", header: "Amount", align: "right", cell: (r: R) => formatMoney(r.total) },
            { key: "bal", header: "Balance due", align: "right", cell: (r: R) => formatMoney(r.balance_due) },
            { key: "due", header: "Due", cell: (r: R) => <span className={r.due_date && r.due_date < today && Number(r.balance_due) > 0 ? "font-medium text-danger" : ""}>{formatDate(r.due_date)}</span> },
            { key: "st", header: "Status", cell: (r: R) => Number(r.balance_due) <= 0 ? <StatusBadge status="paid" /> : r.due_date && r.due_date < today ? <StatusBadge status="overdue" /> : <StatusBadge status="pending" label={r.is_mock ? "Unpaid (simulated)" : humanize(r.external_status ?? "unpaid")} /> },
            { key: "link", header: "", cell: (r: R) => r.external_url && !r.is_mock ? <Link href={r.external_url} target="_blank" className="inline-flex items-center gap-1 text-navy hover:underline">View <ExternalLink className="h-3 w-3" /></Link> : null },
          ]} />
      </Card>
    </>
  );
}
