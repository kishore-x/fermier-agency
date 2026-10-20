import { FileText } from "lucide-react";
import { DataTable } from "@/components/ui/data";
import { Card, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "My quotations" };

export default async function MyQuotations() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("id, quotation_number, revision, status, grand_total, quotation_date, expiry_date").order("created_at", { ascending: false });
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Quotations</h1>
      <Card>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/portal/quotations/${r.id}`}
          empty={<EmptyState icon={<FileText className="h-10 w-10" />} title="No quotations yet" description="Quotations appear here once our team sends them." />}
          columns={[
            { key: "num", header: "Quotation", cell: (r: R) => `${r.quotation_number}${r.revision > 1 ? ` rev ${r.revision}` : ""}` },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status === "sent" ? "awaiting_response" : r.status} label={r.status === "sent" ? "Awaiting your response" : undefined} /> },
            { key: "total", header: "Total", align: "right", cell: (r: R) => formatMoney(r.grand_total) },
            { key: "date", header: "Date", cell: (r: R) => formatDate(r.quotation_date) },
            { key: "exp", header: "Valid until", cell: (r: R) => formatDate(r.expiry_date) },
          ]} />
      </Card>
    </>
  );
}
