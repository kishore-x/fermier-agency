import { Alert, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadEditorData } from "../editor-data";
import { QuotationEditor } from "../quotation-editor";

export default async function NewQuotationPage({ searchParams }: PageProps<"/admin/quotations/new">) {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  const sp = (await searchParams) as { enquiry?: string; customer?: string };
  const data = await loadEditorData(session.userId);
  const supabase = await createClient();
  let header: Parameters<typeof QuotationEditor>[0]["header"] = { customer_id: sp.customer, terms_and_conditions: data.defaultTerms };
  let lines: { product_id: string; quantity: string; unit_price: string; discount_pct: string; description: string }[] = [];
  let enquiryNumber: string | null = null;
  if (sp.enquiry) {
    const { data: e } = await supabase.from("enquiries").select("id, enquiry_number, customer_id, delivery_address, notes, enquiry_items(product_id, quantity)").eq("id", sp.enquiry).maybeSingle();
    if (e) {
      enquiryNumber = e.enquiry_number;
      header = { ...header, enquiry_id: e.id, customer_id: e.customer_id ?? undefined, delivery_address: e.delivery_address };
      const priceMap = new Map(data.products.map((p) => [p.id, p.selling_price]));
      lines = (e.enquiry_items ?? []).filter((i) => i.product_id).map((i) => ({
        product_id: i.product_id!, quantity: String(Number(i.quantity)), unit_price: priceMap.get(i.product_id!) ?? "", discount_pct: "0", description: "",
      }));
    }
  }
  return (
    <>
      <PageHeader title="New quotation" back={sp.enquiry ? { href: `/admin/enquiries/${sp.enquiry}`, label: enquiryNumber ?? "Enquiry" } : { href: "/admin/quotations", label: "Quotations" }}
        description={enquiryNumber ? `Prepared from ${enquiryNumber}. Items and quantities are copied; adjust prices and discounts as needed.` : undefined} />
      {sp.enquiry && !header.customer_id && <Alert tone="warn" className="mb-4">Link the enquiry to a customer first.</Alert>}
      <QuotationEditor header={header} lines={lines} products={data.products} customers={data.customers}
        approvalPct={data.approvalPct} approvalAmount={data.approvalAmount} myLimit={data.myLimit} />
    </>
  );
}
