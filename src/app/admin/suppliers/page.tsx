import Link from "next/link";
import { X } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { linkSupplierProduct, saveSupplier, unlinkSupplierProduct } from "./actions";

export default async function SuppliersPage({ searchParams }: PageProps<"/admin/suppliers">) {
  await requireStaff("admin", "inventory_manager");
  const { edit } = (await searchParams) as { edit?: string };
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("*, supplier_products(product_id, supplier_sku, lead_time_days, products(name, sku))").order("name"),
    supabase.from("products").select("id, name, sku").neq("status", "archived").order("name"),
  ]);
  const editing = suppliers?.find((s) => s.id === edit);
  return (
    <>
      <PageHeader title="Suppliers" description="Supplier master and the products each supplier provides. Supplier purchase orders are a separate future module." />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {(suppliers ?? []).map((s) => (
            <Card key={s.id}>
              <CardHeader title={<span className="flex items-center gap-2">{s.name} <span className="font-mono text-xs font-normal text-muted">{s.supplier_code}</span> <StatusBadge status={s.status} /></span>}
                description={[s.contact_person, s.phone, s.email, s.payment_terms && `Terms: ${s.payment_terms}`].filter(Boolean).join(" · ")}
                action={<Link href={`?edit=${s.id}`} className="text-sm text-navy hover:underline">Edit</Link>} />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {(s.supplier_products as { product_id: string; supplier_sku: string | null; lead_time_days: number | null; products: { name: string; sku: string } }[]).map((sp) => (
                    <span key={sp.product_id} className="flex items-center gap-1 rounded border border-line bg-canvas px-2 py-1 text-xs">
                      {sp.products.name}{sp.lead_time_days != null && <span className="text-muted">· {sp.lead_time_days}d</span>}
                      <ConfirmAction action={unlinkSupplierProduct} fields={{ supplier_id: s.id, product_id: sp.product_id }} trigger={<X className="h-3 w-3" />} triggerVariant="ghost" title="Unlink product?" confirmLabel="Unlink" tone="danger" />
                    </span>
                  ))}
                  {!(s.supplier_products as unknown[]).length && <span className="text-sm text-muted">No products linked.</span>}
                </div>
                <ActionForm action={linkSupplierProduct} resetOnSuccess className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="supplier_id" value={s.id} />
                  <Select name="product_id" required aria-label="Product" className="w-64" defaultValue=""><option value="" disabled>Link a product…</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</Select>
                  <Input name="supplier_sku" placeholder="Supplier SKU" aria-label="Supplier SKU" className="w-36" />
                  <Input name="lead_time_days" placeholder="Lead days" aria-label="Lead time days" inputMode="numeric" className="w-28" />
                  <SubmitButton size="md" variant="outline">Link</SubmitButton>
                </ActionForm>
              </div>
            </Card>
          ))}
          {!suppliers?.length && <Alert>No suppliers yet.</Alert>}
        </div>
        <Card className="h-fit">
          <CardHeader title={editing ? `Edit ${editing.name}` : "Add supplier"} action={editing && <Link href="/admin/suppliers" className="text-sm text-muted">Cancel</Link>} />
          <ActionForm key={editing?.id ?? "new"} action={saveSupplier} resetOnSuccess={!editing} className="space-y-3 p-4">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Name" name="name" required><Input id="name" name="name" defaultValue={editing?.name} required /></Field>
            <Field label="Contact person" name="contact_person"><Input id="contact_person" name="contact_person" defaultValue={editing?.contact_person ?? ""} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone" name="phone"><Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} /></Field>
              <Field label="Email" name="email"><Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} /></Field>
            </div>
            <Field label="Address" name="address"><Textarea id="address" name="address" rows={2} defaultValue={editing?.address ?? ""} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="GSTIN" name="gstin"><Input id="gstin" name="gstin" maxLength={15} defaultValue={editing?.gstin ?? ""} /></Field>
              <Field label="Payment terms" name="payment_terms"><Input id="payment_terms" name="payment_terms" defaultValue={editing?.payment_terms ?? ""} /></Field>
            </div>
            <Field label="Status" name="status"><Select id="status" name="status" defaultValue={editing?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            <Field label="Notes" name="notes"><Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} /></Field>
            <SubmitButton className="w-full">{editing ? "Save supplier" : "Add supplier"}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
