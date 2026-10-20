import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { AddToCartButton } from "@/components/catalog/add-to-cart";
import { ProductGallery } from "@/components/catalog/gallery";
import { ProductCard } from "@/components/catalog/product-card";
import { getCompany, getProductBySlug, whatsappLink } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const data = await getProductBySlug((await params).slug);
  return { title: data?.product.name ?? "Product not found", description: data?.product.short_description ?? undefined };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [data, company] = await Promise.all([getProductBySlug(slug), getCompany()]);
  if (!data) notFound();
  const { product: p, images, specs, docs, related } = data;
  const available = Number(p.available_qty);
  const groups = specs.reduce<Record<string, { label: string; value: string }[]>>((acc, s) => {
    (acc[s.spec_group] ??= []).push(s);
    return acc;
  }, {});
  const wa = whatsappLink(company?.whatsapp_number, `Hello, I'd like details on ${p.name} (${p.sku}).`);
  const storage = (await createClient()).storage.from("product-documents");
  const docUrl = (path: string) => storage.getPublicUrl(path).data.publicUrl;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> / <Link href="/catalog" className="hover:text-ink">Catalog</Link>
        {p.category_slug && <> / <Link href={`/catalog/${p.category_slug}`} className="hover:text-ink">{p.category_name}</Link></>}
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={images} name={p.name} categorySlug={p.category_slug} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{p.brand_name} · {p.category_name}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">{p.name}</h1>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div><dt className="inline text-muted">Code: </dt><dd className="inline font-medium">{p.sku}</dd></div>
            {p.model_number && <div><dt className="inline text-muted">Model: </dt><dd className="inline font-medium">{p.model_number}</dd></div>}
            {p.manufacturer && <div><dt className="inline text-muted">Make: </dt><dd className="inline font-medium">{p.manufacturer}</dd></div>}
          </dl>
          <div className="mt-5 rounded-lg border border-line bg-white p-4">
            {p.display_price ? (
              <>
                <p className="text-3xl font-semibold tnum">{formatMoney(p.display_price)}</p>
                <p className="text-sm text-muted">per {p.unit} · excl. GST {Number(p.tax_rate)}% · indicative price, final price on quotation</p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-navy">Price on request</p>
                <p className="text-sm text-muted">Add to cart and submit — our sales team will send a formal quotation.</p>
              </>
            )}
            <p className={available > 0 ? "mt-3 text-sm font-medium text-brand-600" : "mt-3 text-sm font-medium text-amber-700"}>
              {available > 0 ? `In stock — ${available} ${p.unit} available` : "Currently on order — lead time confirmed on quotation"}
            </p>
            <AddToCartButton product={p} withQty className="mt-4" />
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-brand text-sm font-medium text-brand-600 hover:bg-brand-50">
                <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
              </a>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> Manufacturer warranty</div>
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> Dispatch tracking</div>
          </div>
          {p.short_description && <p className="mt-5 text-sm leading-relaxed text-ink">{p.short_description}</p>}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-base font-semibold">Technical specifications</h2>
          {specs.length ? (
            Object.entries(groups).map(([group, rows]) => (
              <div key={group}>
                <p className="bg-canvas px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} className="border-b border-line last:border-0">
                        <th scope="row" className="w-1/2 px-4 py-2.5 text-left font-normal text-muted">{r.label}</th>
                        <td className="px-4 py-2.5 font-medium">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : <p className="px-4 py-6 text-sm text-muted">Specifications will be shared with your quotation.</p>}
        </section>
        <div className="space-y-6">
          {p.description && (
            <section className="rounded-lg border border-line bg-white p-4">
              <h2 className="text-base font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.description}</p>
            </section>
          )}
          <section className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-base font-semibold">Brochures & documents</h2>
            {docs.length ? (
              <ul className="mt-2 space-y-2">
                {docs.map((d) => (
                  <li key={d.id}><a href={docUrl(d.storage_path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-navy hover:underline"><FileDown className="h-4 w-4" />{d.title}</a></li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No brochure uploaded yet. Ask our team for a datasheet.</p>}
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">More in {p.category_name}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
