import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { moveCategory, saveCategory, toggleCategory } from "../catalog-actions";
import { EditCategory } from "./edit-category";

export default async function CategoriesPage() {
  await requireStaff("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, description, parent_id, sort_order, is_active, products!products_category_id_fkey(count)").order("sort_order").order("name");
  const cats = (data ?? []) as unknown as { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number; is_active: boolean; products: { count: number }[] }[];
  const top = cats.filter((c) => !c.parent_id);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Categories" description="Order controls the sequence on the homepage and catalog. Inactive categories are hidden publicly." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <ul className="divide-y divide-line">
            {top.map((c, i) => (
              <li key={c.id}>
                <Row c={c} first={i === 0} last={i === top.length - 1} parents={top} />
                {cats.filter((s) => s.parent_id === c.id).map((s) => <div key={s.id} className="pl-10"><Row c={s} sub parents={top} /></div>)}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Add category" />
          <ActionForm action={saveCategory} className="space-y-3 p-4" resetOnSuccess>
            <Field label="Name" name="name" required><Input id="name" name="name" required /></Field>
            <Field label="Slug" name="slug" hint="Optional — generated from name"><Input id="slug" name="slug" /></Field>
            <Field label="Parent (for subcategory)" name="parent_id">
              <Select id="parent_id" name="parent_id"><option value="">None — top level</option>{top.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Description" name="description"><Input id="description" name="description" /></Field>
            <input type="hidden" name="sort_order" value={String(top.length + 1)} />
            <SubmitButton className="w-full">Add category</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function Row({ c, first, last, sub, parents }: {
  c: { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number; is_active: boolean; products: { count: number }[] };
  first?: boolean; last?: boolean; sub?: boolean; parents: { id: string; name: string }[];
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon slug={c.slug} className="h-5 w-5 text-navy" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{c.name}</p>
        <p className="text-xs text-muted">/{c.slug} · {c.products[0]?.count ?? 0} products</p>
      </div>
      <StatusBadge status={c.is_active ? "active" : "inactive"} />
      {!sub && (
        <div className="flex">
          <form action={async (fd) => { "use server"; await moveCategory(null, fd); }}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button disabled={first} className="rounded p-1.5 text-muted hover:bg-canvas disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button></form>
          <form action={async (fd) => { "use server"; await moveCategory(null, fd); }}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button disabled={last} className="rounded p-1.5 text-muted hover:bg-canvas disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button></form>
        </div>
      )}
      <EditCategory c={c} parents={parents} />
      <ConfirmAction action={toggleCategory} fields={{ id: c.id, active: String(!c.is_active) }} trigger={c.is_active ? "Deactivate" : "Activate"} triggerVariant="ghost"
        title={c.is_active ? `Deactivate ${c.name}?` : `Activate ${c.name}?`} description={c.is_active ? "Hidden from the public catalog. Products keep their category." : "Shown in the public catalog."}
        confirmLabel={c.is_active ? "Deactivate" : "Activate"} tone={c.is_active ? "danger" : "success"} />
    </div>
  );
}
