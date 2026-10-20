import { ClipboardList } from "lucide-react";
import { DataTable } from "@/components/ui/data";
import { Card, EmptyState, LinkButton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My requests" };

export default async function MyEnquiries() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("enquiries").select("id, enquiry_number, status, created_at, requested_delivery_date, enquiry_items(count)").order("created_at", { ascending: false });
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Order requests</h1>
      <Card>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id} rowHref={(r: R) => `/portal/enquiries/${r.id}`}
          empty={<EmptyState icon={<ClipboardList className="h-10 w-10" />} title="No requests yet" action={<LinkButton href="/catalog" variant="success">Browse catalog</LinkButton>} />}
          columns={[
            { key: "ref", header: "Reference", cell: (r: R) => r.enquiry_number },
            { key: "items", header: "Items", align: "right", cell: (r: R) => (r.enquiry_items as unknown as { count: number }[])[0]?.count ?? 0 },
            { key: "status", header: "Status", cell: (r: R) => <StatusBadge status={r.status} /> },
            { key: "req", header: "Requested delivery", cell: (r: R) => formatDate(r.requested_delivery_date) },
            { key: "at", header: "Submitted", cell: (r: R) => formatDate(r.created_at) },
          ]} />
      </Card>
    </>
  );
}
