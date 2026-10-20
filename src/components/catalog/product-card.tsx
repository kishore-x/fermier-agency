import Link from "next/link";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { formatMoney } from "@/lib/utils";
import { CategoryIcon as CategoryIconLazy, ProductImage } from "./category-icon";
import { AddToCartButton } from "./add-to-cart";

export function ProductCard({ p }: { p: CatalogProduct }) {
  const available = Number(p.available_qty);
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-md">
      <Link href={`/products/${p.slug}`} className="relative block aspect-square border-b border-line bg-white p-3">
        <ProductImage src={p.image_url} alt={p.name} categorySlug={p.category_slug} />
        {p.is_featured && (
          <span className="absolute left-2 top-2 rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Featured</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{p.brand_name ?? "—"} · {p.sku}</p>
        <Link href={`/products/${p.slug}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink hover:text-navy">
          {p.name}
        </Link>
        {p.model_number && <p className="mt-0.5 text-xs text-muted">Model {p.model_number}</p>}
        <div className="mt-auto pt-3">
          <div className="flex items-baseline justify-between gap-2">
            {p.display_price ? (
              <span className="text-base font-semibold text-ink tnum">{formatMoney(p.display_price)}</span>
            ) : (
              <span className="text-sm font-medium text-navy">Price on request</span>
            )}
            <span className={available > 0 ? "text-xs text-ok-600" : "text-xs text-muted"}>
              {available > 0 ? "In stock" : "On order"}
            </span>
          </div>
          {p.display_price && <p className="text-[11px] text-muted">+ GST {Number(p.tax_rate)}%</p>}
          <AddToCartButton product={p} className="mt-3 w-full" compact />
        </div>
      </div>
    </div>
  );
}

export function CategoryCard({ c }: { c: { name: string; slug: string; image_url: string | null } }) {
  return (
    <Link href={`/catalog/${c.slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-line bg-white p-3 text-center transition-colors hover:border-brand/50 hover:bg-brand-50/40">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-canvas text-navy">
        {c.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <CategoryIconLazy slug={c.slug} />
        )}
      </div>
      <span className="text-xs font-medium leading-tight text-ink">{c.name}</span>
    </Link>
  );
}
