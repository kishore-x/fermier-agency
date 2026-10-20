import Link from "next/link";
import { Download, PackageSearch, Plus, Upload } from "lucide-react";
import { DataTable, FilterBar, Pagination } from "@/components/ui/data";
import { ConfirmAction } from "@/components/ui/forms";
import { Card, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductImage } from "@/components/catalog/category-icon";
import { can, requireStaff } from "@/lib/auth";
import { getBrands, getCategories } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatQty, pageRange, searchTerm } from "@/lib/utils";
import { duplicateProduct, setProductStatus } from "./actions";

type Row = {
  id: string; sku: string; name: string; model_number: string | null; selling_price: string | null; status: string; updated_at: string;
  price_visibility: string; categories: { name: string } | null; brands: { name: string } | null; product_images: { url: string }[];
  inventory_balances: { on_hand: string; reserved: string }[];
};

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { from, to, page } = pageRange(Number(sp.page));
  const supabase = await createClient();
  let q = supabase.from("products")
    .select("id, sku, name, model_number, selling_price, price_visibility, status, updated_at, categories!products_category_id_fkey(name), brands(name), product_images(url), inventory_balances(on_hand, reserved)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("sort_order", { referencedTable: "product_images", ascending: true })
    .limit(1, { referencedTable: "product_images" });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,model_number.ilike.%${term}%`);
  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.brand) q = q.eq("brand_id", sp.brand);
  q = sp.status ? q.eq("status", sp.status) : q.neq("status", "archived");
  const [{ data, count, error }, categories, brands] = await Promise.all([q.range(from, to), getCategories(), getBrands()]);
  const rows = (data ?? []) as unknown as Row[];
  const manage = can.manageProducts(session);

  return (
    <>
      <PageHeader title="Products" description="Product master — pricing, specifications, images and stock settings."
        actions={manage && <>
          <LinkButton href="/admin/products/export" variant="outline" prefetch={false}><Download className="h-4 w-4" />Export CSV</LinkButton>
          <LinkButton href="/admin/products/import" variant="outline"><Upload className="h-4 w-4" />Import CSV</LinkButton>
          <LinkButton href="/admin/products/new"><Plus className="h-4 w-4" />New product</LinkButton>
        </>} />
      <Card>
        <FilterBar action="/admin/products" resetHref="/admin/products">
          <Input name="q" defaultValue={sp.q} placeholder="Search name, SKU, model" className="w-64" />
          <Select name="category" defaultValue={sp.category ?? ""} className="w-48">
            <option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select name="brand" defaultValue={sp.brand ?? ""} className="w-40">
            <option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
            <option value="">All (excl. archived)</option><option value="active">Active</option><option value="draft">Draft</option>
            <option value="inactive">Inactive</option><option value="archived">Archived</option>
          </Select>
        </FilterBar>
        {error ? <p className="p-4 text-sm text-danger">Could not load products.</p> : (
          <DataTable rows={rows} rowKey={(r) => r.id}
            empty={<EmptyState icon={<PackageSearch className="h-10 w-10" />} title="No products found" description="Adjust filters or add a new product."
              action={manage ? <LinkButton href="/admin/products/new">New product</LinkButton> : undefined} />}
            columns={[
              { key: "img", header: "", className: "w-14", cell: (r) => (
                <div className="h-10 w-10 overflow-hidden rounded border border-line bg-white"><ProductImage src={r.product_images[0]?.url ?? null} alt="" /></div>) },
              { key: "name", header: "Product", cell: (r) => (
                <div><Link href={`/admin/products/${r.id}`} className="font-medium text-navy hover:underline">{r.name}</Link>
                  <p className="text-xs text-muted">{r.sku}{r.model_number ? ` · ${r.model_number}` : ""}</p></div>) },
              { key: "cat", header: "Category", cell: (r) => r.categories?.name ?? "—" },
              { key: "brand", header: "Brand", cell: (r) => r.brands?.name ?? "—" },
              { key: "price", header: "Price", align: "right", cell: (r) => r.price_visibility === "on_request" ? <span className="text-muted">On request</span> : formatMoney(r.selling_price) },
              { key: "onhand", header: "On hand", align: "right", cell: (r) => formatQty(r.inventory_balances.reduce((a, b) => a + Number(b.on_hand), 0)) },
              { key: "res", header: "Reserved", align: "right", cell: (r) => formatQty(r.inventory_balances.reduce((a, b) => a + Number(b.reserved), 0)) },
              { key: "avail", header: "Available", align: "right", cell: (r) => <span className="font-medium">{formatQty(r.inventory_balances.reduce((a, b) => a + Number(b.on_hand) - Number(b.reserved), 0))}</span> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "upd", header: "Updated", cell: (r) => <span className="text-muted">{formatDate(r.updated_at)}</span> },
              { key: "act", header: "", align: "right", cell: (r) => manage ? (
                <div className="flex justify-end gap-1">
                  <LinkButton href={`/admin/products/${r.id}`} variant="ghost" size="sm">Edit</LinkButton>
                  <ConfirmAction action={duplicateProduct} fields={{ id: r.id }} title="Duplicate product?" description="Creates a draft copy with the same specifications and pricing. Stock is not copied." trigger="Duplicate" triggerVariant="ghost" confirmLabel="Duplicate" />
                  {r.status === "active"
                    ? <ConfirmAction action={setProductStatus} fields={{ id: r.id, status: "inactive" }} title="Deactivate product?" description="It will disappear from the public catalog. Existing quotations and orders are unaffected." trigger="Deactivate" triggerVariant="ghost" confirmLabel="Deactivate" tone="danger" />
                    : r.status !== "archived" && <ConfirmAction action={setProductStatus} fields={{ id: r.id, status: "active" }} title="Activate product?" description="It will appear in the public catalog." trigger="Activate" triggerVariant="ghost" confirmLabel="Activate" tone="success" />}
                </div>
              ) : <LinkButton href={`/admin/products/${r.id}`} variant="ghost" size="sm">View</LinkButton> },
            ]} />
        )}
        <Pagination page={page} total={count ?? 0} pageSize={20} basePath="/admin/products" params={sp} />
      </Card>
    </>
  );
}
