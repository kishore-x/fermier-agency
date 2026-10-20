import { Download } from "lucide-react";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { CSV_COLUMNS } from "@/lib/csv";
import { getCategories } from "@/lib/queries/catalog";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  await requireStaff("admin");
  const categories = await getCategories();
  return (
    <div className="max-w-5xl">
      <PageHeader title="Import products from CSV" back={{ href: "/admin/products", label: "Products" }}
        description="Every row is validated first. If any row has a problem, nothing is imported."
        actions={<LinkButton href="/admin/products/export?template=1" variant="outline" prefetch={false}><Download className="h-4 w-4" />Download template</LinkButton>} />
      <ImportForm />
      <Card className="mt-4">
        <CardHeader title="Column reference" />
        <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium">Columns</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-muted">{CSV_COLUMNS.join(", ")}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
              <li><code>sku</code>, <code>name</code>, <code>category_slug</code> are required.</li>
              <li>Unknown brands are created automatically.</li>
              <li><code>opening_stock</code> applies to new products only and is recorded as a goods-received movement.</li>
              <li>Prices: plain numbers, max 2 decimals, no currency symbols.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">Valid category slugs</p>
            <ul className="mt-1 grid grid-cols-1 gap-x-4 font-mono text-xs text-muted sm:grid-cols-2">
              {categories.map((c) => <li key={c.id}>{c.slug}</li>)}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
