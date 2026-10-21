import Link from "next/link";
import type { CatalogCardProduct } from "@/lib/queries/catalog";
import { whatsappLink } from "@/lib/queries/catalog";
import { formatMoney } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart";
import { CategoryIcon as CategoryIconLazy, ProductImage } from "./category-icon";
import { WhatsAppIcon } from "./whatsapp-icon";

/** Spec-sheet style product card: rating strip, photo, key specification rows, code, price and enquiry actions. */
export function ProductCard({ p, whatsapp }: { p: CatalogCardProduct; whatsapp?: string | null }) {
  const available = Number(p.available_qty);
  // Header strip only fits short ratings ("980mm", "5.5 kW"); long marketing sentences are skipped.
  const ratings = p.specs.map((s) => s.value?.trim()).filter((v): v is string => !!v && v.length <= 14).slice(0, 2);
  const rows: { label: string; value: string }[] = [
    ...(p.brand_name ? [{ label: "Brand", value: p.brand_name }] : []),
    ...(p.model_number && p.model_number !== p.name ? [{ label: "Model", value: p.model_number }] : []),
    ...p.specs.filter((s) => s.label?.trim() && s.value?.trim()),
  ].slice(0, 7);
  const wa = whatsappLink(whatsapp, `Hello, I'd like a quote for ${p.name} (Code: ${p.sku}).`);
  return (
    <div className="group flex flex-col overflow-hidden rounded-md border border-[#dde5ee] bg-white shadow-[0_1px_3px_rgba(14,27,44,0.06)] transition-shadow hover:shadow-lg">
      <Link href={`/products/${p.slug}`} className="flex h-[52px] items-center justify-between gap-2 overflow-hidden bg-navy px-3 py-1.5 text-white">
        <span className="shrink-0 font-display text-[12.5px] font-bold uppercase leading-tight">{ratings.map((r) => <span key={r} className="block">{r}</span>)}</span>
        <span className="line-clamp-2 text-right font-display text-[13px] font-bold uppercase leading-tight" title={p.type ?? p.category_name ?? undefined}>{p.type ?? p.category_name}</span>
      </Link>
      <Link href={`/products/${p.slug}`} className="relative block bg-gradient-to-br from-white via-white to-[#eef2f7] px-3 pb-2 pt-3">
        <div className="flex h-6 items-start justify-between gap-2 overflow-hidden text-[10px] font-bold uppercase leading-tight text-ink-900">
          <span className="truncate">{p.sku}{p.model_number && p.model_number !== p.name ? <><br />▸ {p.model_number}</> : null}</span>
          {p.is_featured && <span className="rounded bg-brand px-1.5 py-0.5 text-[9px] text-white">Featured</span>}
        </div>
        <div className="mx-auto mt-1 flex h-[130px] items-center justify-center">
          <ProductImage src={p.image_url} alt={p.name} categorySlug={p.category_slug} />
        </div>
        {/* Fixed-height spec block (7 rows) so names, prices and buttons line up across the grid. */}
        <dl className="mx-auto mt-2 h-[107px] max-w-[240px] overflow-hidden text-[10.5px] leading-[1.45] text-ink-900">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-1.5">
              <dt className="w-[46%] shrink-0 truncate font-semibold" title={r.label}>{r.label}</dt>
              <dd className="text-muted">:</dd>
              <dd className="min-w-0 flex-1 truncate" title={r.value}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </Link>
      <div className="flex flex-1 flex-col border-t border-line px-3 pb-3 pt-2.5">
        <Link href={`/products/${p.slug}`} className="line-clamp-2 min-h-[2.75em] text-[14px] font-semibold leading-snug text-ink-900 hover:text-brand">{p.name}</Link>
        <p className="mt-0.5 truncate text-xs text-muted" title={p.sku}>Code: {p.sku}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className={available > 0 ? "text-[11px] font-medium text-ok-600" : "text-[11px] font-medium text-amber-700"}>{available > 0 ? "In stock" : "On order"}</span>
          {p.display_price
            ? <span className="text-right"><span className="block text-lg font-bold text-ink-900 tnum">{formatMoney(p.display_price).replace(/\.00$/, "")}</span><span className="block text-[10px] text-muted">+ GST {Number(p.tax_rate)}%</span></span>
            : <span className="text-sm font-semibold text-brand">Price on request</span>}
        </div>
        <AddToCartButton product={p} compact className="mt-2.5 w-full" />
      </div>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center gap-2 bg-[#25D366] text-[13px] font-semibold text-white hover:bg-[#1fb757]">
          <WhatsAppIcon className="h-4 w-4" /> Send Enquiry
        </a>
      )}
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
