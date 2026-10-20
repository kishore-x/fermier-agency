import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { DataTable } from "@/components/ui/data";
import { Card, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "My purchase orders" };

export default async function MyPos() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("customer_purchase_orders").select("id, po_number, po_date, po_amount, status, verification_notes, storage_path, file_name, quotations(id, quotation_number)").order("created_at", { ascending: false });
  const signed = new Map<string, string>();
  for (const p of data ?? []) {
    if (p.storage_path) { const { data: s } = await supabase.storage.from("customer-documents").createSignedUrl(p.storage_path, 600); if (s) signed.set(p.id, s.signedUrl); }
  }
  type R = NonNullable<typeof data>[number];
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Purchase orders</h1>
      <p className="mb-4 text-sm text-muted">Upload a PO from an accepted quotation. Verified POs are locked.</p>
      <Card>
        <DataTable rows={data ?? []} rowKey={(r: R) => r.id}
          empty={<EmptyState icon={<FileCheck2 className="h-10 w-10" />} title="No purchase orders uploaded" />}
          columns={[
            { key: "po", header: "PO number", cell: (r: R) => <span className="font-medium">{r.po_number}</span> },
            { key: "qt", header: "Quotation", cell: (r: R) => { const q = r.quotations as unknown as { id: string; quotation_number: string }; return <Link href={`/portal/quotations/${q.id}`} className="text-navy hover:underline">{q.quotation_number}</Link>; } },
            { key: "amt", header: "Amount", align: "right", cell: (r: R) => formatMoney(r.po_amount) },
            { key: "date", header: "PO date", cell: (r: R) => formatDate(r.po_date) },
            { key: "status", header: "Status", cell: (r: R) => <div><StatusBadge status={r.status} />{r.status === "requires_correction" && <p className="mt-1 max-w-xs text-xs text-amber-800">{r.verification_notes}</p>}</div> },
            { key: "doc", header: "Document", cell: (r: R) => signed.get(r.id) ? <Link href={signed.get(r.id)!} target="_blank" className="text-navy hover:underline">{r.file_name ?? "View"}</Link> : "—" },
          ]} />
      </Card>
    </>
  );
}
