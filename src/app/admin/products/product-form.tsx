"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Button, Field, FormSection, Input, Select, Textarea } from "@/components/ui/primitives";
import { saveProduct } from "./actions";

type Opt = { id: string; name: string };
export type ProductFormValues = {
  id?: string; sku?: string; name?: string; slug?: string; brand_id?: string | null; manufacturer?: string | null; category_id?: string | null;
  subcategory_id?: string | null; model_number?: string | null; short_description?: string | null; description?: string | null; unit?: string;
  selling_price?: string | null; purchase_cost?: string | null; tax_rate?: string; hsn_code?: string | null; price_visibility?: string;
  reorder_threshold?: string; is_featured?: boolean; status?: string;
  features?: string[]; applications?: string[]; in_the_box?: string[]; warranty?: string | null;
  specs?: { spec_group: string; label: string; value: string }[];
};

export function ProductForm({ values = {}, categories, brands, showCost, readOnly }: {
  values?: ProductFormValues; categories: (Opt & { parent_id: string | null })[]; brands: Opt[]; showCost: boolean; readOnly?: boolean;
}) {
  const [specs, setSpecs] = useState(values.specs?.length ? values.specs : [{ spec_group: "General", label: "", value: "" }]);
  const v = (k: keyof ProductFormValues) => (values[k] ?? "") as string;
  const top = categories.filter((c) => !c.parent_id);
  const sub = categories.filter((c) => c.parent_id);
  return (
    <ActionForm action={saveProduct} className="space-y-4">
      {(s) => {
        const e = s?.fieldErrors ?? {};
        return (
          <fieldset disabled={readOnly} className="space-y-4">
            <input type="hidden" name="id" value={values.id ?? ""} />
            <input type="hidden" name="specs" value={JSON.stringify(specs)} />
            <FormSection title="1. Basic information">
              <Field label="Product name" name="name" required error={e.name}><Input id="name" name="name" defaultValue={v("name")} required /></Field>
              <Field label="SKU / product code" name="sku" required error={e.sku} hint="Unique. Stored in upper case."><Input id="sku" name="sku" defaultValue={v("sku")} required className="uppercase" /></Field>
              <Field label="Model number" name="model_number" error={e.model_number}><Input id="model_number" name="model_number" defaultValue={v("model_number")} /></Field>
              <Field label="URL slug" name="slug" error={e.slug} hint="Leave blank to generate from name + SKU"><Input id="slug" name="slug" defaultValue={v("slug")} /></Field>
              <Field label="Short description" name="short_description" className="sm:col-span-2" error={e.short_description}><Input id="short_description" name="short_description" defaultValue={v("short_description")} maxLength={300} /></Field>
              <Field label="Full description" name="description" className="sm:col-span-2"><Textarea id="description" name="description" defaultValue={v("description")} rows={5} /></Field>
            </FormSection>

            <FormSection title="Product page content" description="Shown on the public product page. One item per line.">
              <Field label="Key features" name="features" className="sm:col-span-2"><Textarea id="features" name="features" rows={5} defaultValue={(values.features ?? []).join("\n")} placeholder={"24 kN centrifugal force\nLow-vibration handle"} /></Field>
              <Field label="Applications" name="applications"><Textarea id="applications" name="applications" rows={4} defaultValue={(values.applications ?? []).join("\n")} /></Field>
              <Field label="What's in the box" name="in_the_box"><Textarea id="in_the_box" name="in_the_box" rows={4} defaultValue={(values.in_the_box ?? []).join("\n")} /></Field>
              <Field label="Warranty" name="warranty" className="sm:col-span-2"><Input id="warranty" name="warranty" defaultValue={values.warranty ?? ""} maxLength={500} /></Field>
            </FormSection>

            <FormSection title="2. Classification">
              <Field label="Category" name="category_id" required error={e.category_id}>
                <Select id="category_id" name="category_id" defaultValue={v("category_id")} required>
                  <option value="">Select category</option>{top.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Subcategory" name="subcategory_id">
                <Select id="subcategory_id" name="subcategory_id" defaultValue={v("subcategory_id")}>
                  <option value="">None</option>{sub.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Brand" name="brand_id">
                <Select id="brand_id" name="brand_id" defaultValue={v("brand_id")}>
                  <option value="">None</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Manufacturer" name="manufacturer"><Input id="manufacturer" name="manufacturer" defaultValue={v("manufacturer")} /></Field>
            </FormSection>

            <div className="rounded-lg border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div><h3 className="text-sm font-semibold">4. Technical specifications</h3><p className="text-xs text-muted">Rendered on the product page, grouped by section.</p></div>
                {!readOnly && <Button type="button" variant="outline" size="sm" onClick={() => setSpecs((x) => [...x, { spec_group: x.at(-1)?.spec_group ?? "General", label: "", value: "" }])}><Plus className="h-4 w-4" />Add row</Button>}
              </div>
              <div className="space-y-2 p-4">
                <div className="hidden grid-cols-[1fr_1.4fr_1.4fr_auto] gap-2 text-xs font-medium text-muted sm:grid"><span>Group</span><span>Specification</span><span>Value</span><span className="w-9" /></div>
                {specs.map((sp, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_1.4fr_auto]">
                    <Input aria-label="Group" value={sp.spec_group} placeholder="e.g. Motor" onChange={(ev) => setSpecs((x) => x.map((r, j) => j === i ? { ...r, spec_group: ev.target.value } : r))} />
                    <Input aria-label="Specification" value={sp.label} placeholder="e.g. Motor power" onChange={(ev) => setSpecs((x) => x.map((r, j) => j === i ? { ...r, label: ev.target.value } : r))} />
                    <Input aria-label="Value" value={sp.value} placeholder="e.g. 3 HP" onChange={(ev) => setSpecs((x) => x.map((r, j) => j === i ? { ...r, value: ev.target.value } : r))} />
                    {!readOnly && <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => setSpecs((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-muted" /></Button>}
                  </div>
                ))}
                <p className="text-xs text-muted">Rows with an empty specification or value are ignored.</p>
              </div>
            </div>

            <FormSection title="5. Pricing and taxes">
              <Field label="Selling price (₹, excl. GST)" name="selling_price" error={e.selling_price}><Input id="selling_price" name="selling_price" inputMode="decimal" defaultValue={v("selling_price")} /></Field>
              <Field label="Price visibility" name="price_visibility">
                <Select id="price_visibility" name="price_visibility" defaultValue={v("price_visibility") || "show_price"}>
                  <option value="show_price">Show price publicly</option><option value="on_request">Price on request (quotation only)</option>
                </Select>
              </Field>
              <Field label="GST rate (%)" name="tax_rate" required error={e.tax_rate}><Input id="tax_rate" name="tax_rate" inputMode="decimal" defaultValue={v("tax_rate") || "18"} required /></Field>
              <Field label="HSN code" name="hsn_code"><Input id="hsn_code" name="hsn_code" defaultValue={v("hsn_code")} /></Field>
              {showCost ? (
                <Field label="Purchase cost (₹)" name="purchase_cost" hint="Visible only to Admin and Inventory roles" error={e.purchase_cost}>
                  <Input id="purchase_cost" name="purchase_cost" inputMode="decimal" defaultValue={v("purchase_cost")} />
                </Field>
              ) : <input type="hidden" name="purchase_cost" value="" />}
            </FormSection>

            <FormSection title="6. Inventory settings" description="Stock quantities are changed only through inventory movements.">
              <Field label="Unit of measurement" name="unit" required><Input id="unit" name="unit" defaultValue={v("unit") || "Nos"} required /></Field>
              <Field label="Reorder threshold" name="reorder_threshold" error={e.reorder_threshold}><Input id="reorder_threshold" name="reorder_threshold" inputMode="decimal" defaultValue={v("reorder_threshold") || "0"} /></Field>
            </FormSection>

            <FormSection title="8. Visibility and status">
              <Field label="Status" name="status">
                <Select id="status" name="status" defaultValue={v("status") || "draft"}>
                  <option value="draft">Draft — hidden</option><option value="active">Active — in catalog</option><option value="inactive">Inactive — hidden</option><option value="archived">Archived</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="is_featured" defaultChecked={values.is_featured} className="h-4 w-4 accent-[#4CAF50]" /> Featured on homepage
              </label>
            </FormSection>

            {!readOnly && (
              <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                <SubmitButton>{values.id ? "Save changes" : "Create product"}</SubmitButton>
              </div>
            )}
          </fieldset>
        );
      }}
    </ActionForm>
  );
}
