import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Card, CardHeader, Input, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveBrand, toggleBrand } from "../catalog-actions";

export default async function BrandsPage() {
  await requireStaff("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name, slug, is_active, products(count)").order("name");
  const brands = (data ?? []) as unknown as { id: string; name: string; slug: string; is_active: boolean; products: { count: number }[] }[];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Brands" />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <ul className="divide-y divide-line">
            {brands.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ActionForm action={saveBrand} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Input name="name" defaultValue={b.name} aria-label="Brand name" className="h-9 max-w-xs" />
                  <SubmitButton size="sm" variant="outline">Rename</SubmitButton>
                </ActionForm>
                <span className="text-xs text-muted">{b.products[0]?.count ?? 0} products</span>
                <StatusBadge status={b.is_active ? "active" : "inactive"} />
                <ConfirmAction action={toggleBrand} fields={{ id: b.id, active: String(!b.is_active) }} trigger={b.is_active ? "Deactivate" : "Activate"}
                  triggerVariant="ghost" title={`${b.is_active ? "Deactivate" : "Activate"} ${b.name}?`} confirmLabel="Confirm" />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Add brand" />
          <ActionForm action={saveBrand} className="space-y-3 p-4" resetOnSuccess>
            <Input name="name" placeholder="Brand name" aria-label="Brand name" required />
            <SubmitButton className="w-full">Add brand</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
