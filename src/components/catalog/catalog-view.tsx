import Link from "next/link";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "./product-card";
import { Pagination } from "@/components/ui/data";
import { EmptyState, LinkButton } from "@/components/ui/primitives";
import { type CatalogFilters, getBrands, getCategories, getCompany, listCatalog } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils";

const SORTS: [string, string][] = [["featured", "Featured"], ["name", "Name A–Z"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["newest", "Newest"]];

export async function CatalogView({ filters, basePath, title, lockedCategory, embedded }: {
  filters: CatalogFilters; basePath: string; title: string; lockedCategory?: string; embedded?: boolean;
}) {
  const [{ rows, total, page, pageSize }, categories, brands, company] = await Promise.all([
    listCatalog({ ...filters, category: lockedCategory ?? filters.category }, 24),
    getCategories(), getBrands(), getCompany(),
  ]);
  const active = Object.entries({ q: filters.q, category: lockedCategory ? undefined : filters.category, brand: filters.brand,
    availability: filters.availability, min: filters.min, max: filters.max }).filter(([, v]) => v);
  const without = (key: string) => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && k !== key && k !== "page" && k !== "focus" && sp.set(k, v));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const labelFor = (k: string, v: string) =>
    k === "category" ? categories.find((c) => c.slug === v)?.name ?? v
    : k === "brand" ? brands.find((b) => b.slug === v)?.name ?? v
    : k === "availability" ? "In stock only" : k === "min" ? `Min ₹${v}` : k === "max" ? `Max ₹${v}` : `“${v}”`;

  return (
    <div id="products" className="container-site scroll-mt-20 py-6">
      {embedded ? (
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-display text-[22px] font-bold uppercase tracking-tight text-ink-900">{title}</h2>
          <p className="text-sm text-muted tnum">{total} product{total === 1 ? "" : "s"}</p>
        </div>
      ) : (
        <>
          <nav className="mb-2 text-xs text-muted"><Link href="/" className="hover:text-ink">Home</Link> / <Link href="/catalog" className="hover:text-ink">Catalog</Link>{lockedCategory && <> / {title}</>}</nav>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-muted tnum">{total} product{total === 1 ? "" : "s"}</p>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div>
        <input type="checkbox" id="filters-toggle" className="peer sr-only" />
        <label htmlFor="filters-toggle" className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-white text-sm font-medium lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> Filters & sort{active.length ? ` (${active.length})` : ""}
        </label>
        <form action={basePath} className="mt-2 hidden h-fit space-y-4 rounded-lg border border-line bg-white p-4 text-sm peer-checked:block lg:sticky lg:top-20 lg:mt-0 lg:block">
          <div>
            <label className="mb-1 block font-medium" htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={filters.q} placeholder="Name, SKU, brand, model" autoFocus={filters.focus === "search"}
              className="h-9 w-full rounded-md border border-line px-2 focus:border-navy focus:outline-none" />
          </div>
          {!lockedCategory && (
            <div>
              <label className="mb-1 block font-medium" htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={filters.category ?? ""} className="h-9 w-full rounded-md border border-line px-2">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block font-medium" htmlFor="brand">Brand</label>
            <select id="brand" name="brand" defaultValue={filters.brand ?? ""} className="h-9 w-full rounded-md border border-line px-2">
              <option value="">All brands</option>
              {brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <span className="mb-1 block font-medium">Price (₹)</span>
            <div className="flex gap-2">
              <input name="min" inputMode="numeric" defaultValue={filters.min} placeholder="Min" aria-label="Minimum price" className="h-9 w-full rounded-md border border-line px-2" />
              <input name="max" inputMode="numeric" defaultValue={filters.max} placeholder="Max" aria-label="Maximum price" className="h-9 w-full rounded-md border border-line px-2" />
            </div>
            <p className="mt-1 text-xs text-muted">Products with price on request are hidden when filtering by price.</p>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="availability" value="in_stock" defaultChecked={filters.availability === "in_stock"} className="h-4 w-4 accent-[#4CAF50]" />
            In stock only
          </label>
          <div>
            <label className="mb-1 block font-medium" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={filters.sort ?? "featured"} className="h-9 w-full rounded-md border border-line px-2">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="h-9 flex-1 rounded-md bg-navy font-medium text-white hover:bg-navy-700">Apply</button>
            <Link href={basePath} className="h-9 rounded-md border border-line px-3 leading-9 text-muted hover:text-ink">Reset</Link>
          </div>
        </form>
        </div>

        <div>
          {active.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {active.map(([k, v]) => (
                <Link key={k} href={without(k)} className="flex items-center gap-1 rounded-full border border-brand/40 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50/60">
                  {labelFor(k, v!)} <X className="h-3 w-3" />
                </Link>
              ))}
              <Link href={basePath} className="text-xs text-muted underline">Clear all</Link>
            </div>
          )}
          {rows.length ? (
            <div className="overflow-hidden rounded-lg border border-line bg-white">
              <div className={cn("grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5")}>
                {rows.map((p) => <ProductCard key={p.id} p={p} whatsapp={company?.whatsapp_number} />)}
              </div>
              <Pagination page={page} total={total} pageSize={pageSize} basePath={basePath}
                params={{ ...filters, focus: undefined } as Record<string, string | undefined>} />
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-white">
              <EmptyState icon={<PackageSearch className="h-10 w-10" />} title="No products match these filters"
                description="Try a different search term or remove a filter. You can also send us an enquiry for products not listed."
                action={<div className="flex gap-2"><LinkButton href={basePath} variant="outline">Clear filters</LinkButton><LinkButton href="/contact" variant="success">Send an enquiry</LinkButton></div>} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
