import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadEditorData } from "../../editor-data";
import { QuotationEditor } from "../../quotation-editor";

export default async function EditQuotationPage({ params }: PageProps<"/admin/quotations/[id]/edit">) {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: q }, { data: items }, data] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("product_id, quantity, unit_price, discount_pct, description_snapshot").eq("quotation_id", id).order("sort_order"),
    loadEditorData(session.userId),
  ]);
  if (!q) notFound();
  if (!["draft", "pending_approval", "approved", "sent", "rejected"].includes(q.status)) redirect(`/admin/quotations/${id}`);
  return (
    <>
      <PageHeader title={`Edit ${q.quotation_number}`} back={{ href: `/admin/quotations/${id}`, label: q.quotation_number }} />
      <QuotationEditor
        header={{ ...q, enquiry_id: q.enquiry_id ?? undefined, shipping_charges: String(Number(q.shipping_charges)), other_charges: String(Number(q.other_charges)) }}
        lines={(items ?? []).map((i) => ({ product_id: i.product_id ?? "", quantity: String(Number(i.quantity)), unit_price: String(Number(i.unit_price)), discount_pct: String(Number(i.discount_pct)), description: i.description_snapshot ?? "" }))}
        products={data.products} customers={data.customers} approvalPct={data.approvalPct} approvalAmount={data.approvalAmount} myLimit={data.myLimit} />
    </>
  );
}
