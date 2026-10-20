import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, FileText, Package, Send, ShieldCheck, Truck, Wrench } from "lucide-react";
import { AddToCartButton } from "@/components/catalog/add-to-cart";
import { ProductGallery } from "@/components/catalog/gallery";
import { ProductCard } from "@/components/catalog/product-card";
import { RaisePurchaseOrder } from "@/components/catalog/raise-po";
import { WhatsAppIcon } from "@/components/catalog/whatsapp-icon";
import { getSession } from "@/lib/auth";
import { getCompany, getProductBySlug, whatsappLink } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const data = await getProductBySlug((await params).slug);
  return { title: data?.product.name ?? "Product not found", description: data?.product.short_description ?? undefined };
}

const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-24 font-display text-[22px] font-bold uppercase tracking-tight text-ink-900">{children}</h2>
);

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [data, company, session] = await Promise.all([getProductBySlug(slug), getCompany(), getSession()]);
  if (!data) notFound();
  const { product: p, images, specs, docs, related } = data;
  const supabase = await createClient();
  const available = Number(p.available_qty);
  const type = specs.find((s) => s.label === "Type")?.value ?? null;
  const sheet = specs.filter((s) => s.label !== "Type");
  const groups = sheet.reduce<Record<string, { label: string; value: string }[]>>((acc, s) => { (acc[s.spec_group] ??= []).push(s); return acc; }, {});
  const highlights = sheet.slice(0, 4);
  const wa = whatsappLink(company?.whatsapp_number, `Hello, I'd like a quote for ${p.name} (Code: ${p.sku}).`);
  const docUrl = (path: string) => (path.startsWith("/") || path.startsWith("http") ? path : supabase.storage.from("product-documents").getPublicUrl(path).data.publicUrl);

  let defaultAddress = "";
  if (session?.customerId) {
    const [{ data: addr }, { data: cust }] = await Promise.all([
      supabase.from("customer_addresses").select("line1, city, state, postal_code").eq("customer_id", session.customerId).order("is_default", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("customers").select("billing_address").eq("id", session.customerId).single(),
    ]);
    defaultAddress = addr ? [addr.line1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ") : cust?.billing_address ?? "";
  }

  const nav = [
    ["overview", "Overview"], ["specifications", "Specifications"],
    ...(p.applications?.length ? [["applications", "Applications"]] : []),
    ...(p.in_the_box?.length || p.warranty ? [["box", "In the box & warranty"]] : []),
    ["documents", "Brochures"],
  ];

  return (
    <div className="bg-page pb-14">
      <div className="container-site pt-5">
        <nav className="mb-4 text-xs text-muted">
          <Link href="/" className="hover:text-ink">Home</Link> / <Link href="/catalog" className="hover:text-ink">Products</Link>
          {p.category_slug && <> / <Link href={`/catalog/${p.category_slug}`} className="hover:text-ink">{p.category_name}</Link></>} / <span className="text-ink">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ProductGallery images={images} name={p.name} categorySlug={p.category_slug} />
          </div>

          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-brand">{[p.brand_name, p.category_name].filter(Boolean).join(" · ")}</p>
            <h1 className="mt-1.5 font-display text-[32px] font-bold leading-tight tracking-tight text-ink-900">{p.name}</h1>
            {type && <p className="text-lg text-[#3d4652]">{type}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-sm bg-band px-2.5 py-1"><span className="text-muted">Code</span> <strong>{p.sku}</strong></span>
              {p.model_number && p.model_number !== p.name && <span className="rounded-sm bg-band px-2.5 py-1"><span className="text-muted">Model</span> <strong>{p.model_number}</strong></span>}
              {p.brand_name && <span className="rounded-sm bg-band px-2.5 py-1"><span className="text-muted">Brand</span> <strong>{p.brand_name}</strong></span>}
              {p.hsn_code && <span className="rounded-sm bg-band px-2.5 py-1"><span className="text-muted">HSN</span> <strong>{p.hsn_code}</strong></span>}
            </div>
            {p.short_description && <p className="mt-4 text-[15px] leading-relaxed text-[#3d4652]">{p.short_description}</p>}

            {highlights.length > 0 && (
              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {highlights.map((h) => (
                  <div key={h.label} className="rounded-sm border border-[#dde5ee] bg-white px-3 py-2.5">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{h.label}</dt>
                    <dd className="mt-0.5 font-display text-lg font-bold text-ink-900">{h.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-5 space-y-3 rounded-md border border-[#dde5ee] bg-white p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                {p.display_price ? (
                  <div>
                    <p className="text-3xl font-bold text-ink-900 tnum">{formatMoney(p.display_price)}</p>
                    <p className="text-xs text-muted">per {p.unit} · excl. GST {Number(p.tax_rate)}% · indicative, final price on quotation</p>
                  </div>
                ) : (
                  <div><p className="text-xl font-bold text-brand">Price on request</p><p className="text-xs text-muted">Request a quote or raise your PO — we&apos;ll confirm pricing.</p></div>
                )}
                <p className={available > 0 ? "text-sm font-semibold text-ok-600" : "text-sm font-semibold text-amber-700"}>
                  {available > 0 ? `In stock · ${available} ${p.unit} available` : "On order · lead time on quotation"}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/contact?product=${encodeURIComponent(`${p.name} (Code: ${p.sku})`)}`} className="flex h-12 items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600">
                  <Send className="h-4 w-4" /> Enquire now
                </Link>
                <a href={`/products/${p.slug}/datasheet`} className="flex h-12 items-center justify-center gap-2 rounded-md border-2 border-ink-900 text-sm font-bold uppercase tracking-wide text-ink-900 hover:bg-band">
                  <Download className="h-4 w-4" /> Download datasheet
                </a>
              </div>
              {!session?.isStaff && <AddToCartButton product={p} withQty label={p.display_price ? "Add to cart" : "Add to quote request"} />}
              <RaisePurchaseOrder product={p} defaultAddress={defaultAddress} returnTo={`/products/${p.slug}`}
                signedInAs={!session ? "guest" : session.customerId ? "customer" : "staff"} />
              <div className="grid gap-2 sm:grid-cols-2">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-semibold text-white hover:bg-[#1fb757]">
                    <WhatsAppIcon className="h-5 w-5" /> Send enquiry on WhatsApp
                  </a>
                )}
                {docs[0] && (
                  <a href={docUrl(docs[0].storage_path)} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold text-ink-900 hover:bg-band">
                    <Download className="h-4 w-4" /> Download brochure
                  </a>
                )}
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 text-[13px] text-[#3d4652] sm:grid-cols-4">
              <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand" strokeWidth={1.5} />Genuine product</li>
              <li className="flex items-center gap-2"><Wrench className="h-5 w-5 text-brand" strokeWidth={1.5} />Service support</li>
              <li className="flex items-center gap-2"><Package className="h-5 w-5 text-brand" strokeWidth={1.5} />Spares available</li>
              <li className="flex items-center gap-2"><Truck className="h-5 w-5 text-brand" strokeWidth={1.5} />Dispatch tracking</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sticky top-[60px] z-30 mt-10 border-y border-line bg-white/95 backdrop-blur">
        <nav className="container-site flex gap-6 overflow-x-auto text-[12px] font-bold uppercase tracking-wide">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="whitespace-nowrap border-b-2 border-transparent py-3 text-ink-900 hover:border-brand hover:text-brand">{label}</a>)}
        </nav>
      </div>

      <div className="container-site mt-8 space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionTitle id="overview">Product overview</SectionTitle>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#3d4652]">{p.description ?? p.short_description}</p>
          </div>
          {p.features?.length > 0 && (
            <div className="rounded-md border border-[#dde5ee] bg-white p-5">
              <h3 className="font-display text-lg font-bold uppercase text-ink-900">Key features</h3>
              <ul className="mt-3 space-y-2.5">
                {p.features.map((f) => <li key={f} className="flex gap-2.5 text-[14px] text-[#3d4652]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{f}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section>
          <SectionTitle id="specifications">Technical specifications</SectionTitle>
          {sheet.length ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {Object.entries(groups).map(([group, rows]) => (
                <div key={group} className="overflow-hidden rounded-md border border-[#dde5ee] bg-white">
                  <p className="bg-navy px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">{group}</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.label} className={i % 2 ? "bg-band/50" : ""}>
                          <th scope="row" className="w-1/2 px-4 py-2.5 text-left font-medium text-[#5b6472]">{r.label}</th>
                          <td className="px-4 py-2.5 font-semibold text-ink-900">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="overflow-hidden rounded-md border border-[#dde5ee] bg-white">
                <p className="bg-navy px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">Commercial</p>
                <table className="w-full text-sm"><tbody>
                  {[["Brand", p.brand_name], ["Model", p.model_number], ["Product code", p.sku], ["HSN code", p.hsn_code], ["GST", `${Number(p.tax_rate)}%`], ["Unit", p.unit]].filter(([, v]) => v).map(([k, v], i) => (
                    <tr key={k} className={i % 2 ? "bg-band/50" : ""}><th scope="row" className="w-1/2 px-4 py-2.5 text-left font-medium text-[#5b6472]">{k}</th><td className="px-4 py-2.5 font-semibold text-ink-900">{v}</td></tr>
                  ))}
                </tbody></table>
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-muted">Detailed specifications will be shared with your quotation.</p>}
        </section>

        {p.applications?.length > 0 && (
          <section>
            <SectionTitle id="applications">Applications</SectionTitle>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.applications.map((a) => <li key={a} className="rounded-sm border border-brand/30 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">{a}</li>)}
            </ul>
          </section>
        )}

        {(p.in_the_box?.length > 0 || p.warranty) && (
          <section className="grid gap-4 md:grid-cols-2">
            <div id="box" className="scroll-mt-24 rounded-md border border-[#dde5ee] bg-white p-5">
              <h3 className="font-display text-lg font-bold uppercase text-ink-900">What&apos;s in the box</h3>
              {p.in_the_box?.length ? <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] text-[#3d4652]">{p.in_the_box.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-2 text-sm text-muted">Confirmed on quotation.</p>}
            </div>
            <div className="rounded-md border border-[#dde5ee] bg-white p-5">
              <h3 className="font-display text-lg font-bold uppercase text-ink-900">Warranty & support</h3>
              <p className="mt-3 text-[14px] text-[#3d4652]">{p.warranty ?? "As per manufacturer terms."}</p>
              <p className="mt-2 text-[13px] text-muted">Commissioning, service and genuine spares available through our service network.</p>
            </div>
          </section>
        )}

        <section>
          <SectionTitle id="documents">Brochures & documents</SectionTitle>
          <a href={`/products/${p.slug}/datasheet`} className="mt-4 flex max-w-md items-center gap-3 rounded-md border border-[#dde5ee] bg-white p-3 text-sm font-medium text-ink-900 hover:border-brand">
            <FileText className="h-5 w-5 text-brand" />{p.name} — product data sheet (PDF)<Download className="ml-auto h-4 w-4 text-muted" />
          </a>
          {docs.length ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((d) => (
                <li key={d.id}><a href={docUrl(d.storage_path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md border border-[#dde5ee] bg-white p-3 text-sm font-medium text-ink-900 hover:border-brand"><FileText className="h-5 w-5 text-brand" />{d.title}<Download className="ml-auto h-4 w-4 text-muted" /></a></li>
              ))}
            </ul>
          ) : null}
        </section>

        {related.length > 0 && (
          <section>
            <SectionTitle id="related">More in {p.category_name}</SectionTitle>
            <div className="mt-4 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} whatsapp={company?.whatsapp_number} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
