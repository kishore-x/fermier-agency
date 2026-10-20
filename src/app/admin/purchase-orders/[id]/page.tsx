import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, DescriptionList, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { confirmSalesOrder, verifyPo } from "../../orders-actions";

export default async function PoDetail({ params }: PageProps<"/admin/purchase-orders/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const { data: po } = await supabase.from("customer_purchase_orders").select("*, customers(id, company_name), quotations(id, quotation_number, revision, grand_total, currency, status, payment_terms, customer_id), verifier:profiles!customer_purchase_orders_verified_by_fkey(full_name)").eq("id", id).maybeSingle();
  if (!po) notFound();
  const q = po.quotations as { id: string; quotation_number: string; revision: number; grand_total: string; currency: string; status: string; payment_terms: string | null; customer_id: string };
  const cust = po.customers as { id: string; company_name: string };
  const [{ data: so }, signed] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number").eq("quotation_id", q.id).maybeSingle(),
    po.storage_path ? supabase.storage.from("customer-documents").createSignedUrl(po.storage_path, 600) : Promise.resolve({ data: null }),
  ]);
  const checks: [string, string, string, boolean][] = [
    ["Customer", cust.company_name, cust.company_name, po.customer_id === q.customer_id],
    ["Currency", po.currency, q.currency, po.currency === q.currency],
    ["Amount", formatMoney(po.po_amount), formatMoney(q.grand_total), Number(po.po_amount) === Number(q.grand_total)],
    ["Quotation status", "—", q.status, ["accepted", "converted"].includes(q.status)],
    ["Document attached", po.file_name ?? "None", "Required", !!po.storage_path],
  ];
  const isPdf = po.file_name?.toLowerCase().endsWith(".pdf");
  return (
    <>
      <PageHeader back={{ href: "/admin/purchase-orders", label: "Customer POs" }}
        title={<span className="flex items-center gap-2">PO {po.po_number} <StatusBadge status={po.status} /></span>}
        description={<><Link href={`/admin/customers/${cust.id}`} className="text-navy hover:underline">{cust.company_name}</Link> · against <Link href={`/admin/quotations/${q.id}`} className="text-navy hover:underline">{q.quotation_number}{q.revision > 1 ? ` rev ${q.revision}` : ""}</Link></>}
        actions={so && <LinkButton href={`/admin/sales-orders/${so.id}`} variant="success">{so.order_number}</LinkButton>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Verification against accepted quotation" description="All checks must pass to confirm the sales order. Discrepancies are sent back, never auto-corrected." />
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Check</th><th className="px-4 py-2">PO</th><th className="px-4 py-2">Quotation</th><th className="px-4 py-2" /></tr></thead>
              <tbody>{checks.map(([l, a, b, ok]) => (
                <tr key={l} className="border-b border-line"><td className="px-4 py-2">{l}</td><td className="px-4 py-2 tnum">{a}</td><td className="px-4 py-2 tnum">{b}</td>
                  <td className="px-4 py-2">{ok ? <Check className="h-4 w-4 text-ok" /> : <X className="h-4 w-4 text-danger" />}</td></tr>
              ))}</tbody>
            </table>
            <p className="px-4 py-2 text-xs text-muted">Also compare items and quantities on the PO document with the quotation lines before verifying.</p>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <DescriptionList items={[["PO date", formatDate(po.po_date)], ["Received", formatDateTime(po.created_at)], ["Notes", po.notes],
              ["Verification", po.verified_at ? `${(po.verifier as { full_name: string } | null)?.full_name} · ${formatDateTime(po.verified_at)}` : "Not yet verified"],
              ["Verification notes", po.verification_notes]]} />
          </Card>
          {can.confirmOrders(session) && (
            <Card>
              <CardHeader title="Actions" />
              <div className="space-y-3 p-4">
                {po.status !== "verified" && (
                  <ConfirmAction action={verifyPo} fields={{ id: po.id }} trigger="Run verification" triggerVariant="primary" title="Verify this PO?"
                    description="Checks the PO against the accepted quotation. If anything differs it's marked “requires correction” and the customer must re-issue." requireNote="Verification notes (e.g. items and quantities checked against document)" confirmLabel="Verify" />
                )}
                {po.status === "requires_correction" && <Alert tone="warn">Ask the customer to upload a corrected PO. This one is kept on file.</Alert>}
                {po.status === "verified" && !so && (
                  <ActionForm action={confirmSalesOrder}>
                    <input type="hidden" name="quotation_id" value={q.id} /><input type="hidden" name="po_id" value={po.id} />
                    <SubmitButton variant="success" pendingText="Confirming…">Confirm sales order</SubmitButton>
                    <p className="mt-2 text-xs text-muted">Copies the accepted prices and terms into a sales order. Repeated clicks return the same order.</p>
                  </ActionForm>
                )}
                {po.status === "verified" && <p className="text-xs text-muted">Verified POs are locked and cannot be replaced or deleted.</p>}
              </div>
            </Card>
          )}
        </div>
        <Card className="overflow-hidden">
          <CardHeader title={po.file_name ?? "PO document"} action={signed.data && <Link href={signed.data.signedUrl} target="_blank" className="flex items-center gap-1 text-sm text-navy hover:underline">Open <ExternalLink className="h-3.5 w-3.5" /></Link>} />
          {signed.data ? (isPdf ? <iframe src={signed.data.signedUrl} className="h-[640px] w-full" title="PO document preview" />
            : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signed.data.signedUrl} alt="PO document" className="w-full" />
            ))
            : <p className="p-6 text-sm text-muted">No document available.</p>}
        </Card>
      </div>
    </>
  );
}
