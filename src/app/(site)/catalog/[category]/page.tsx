import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, Lightbulb } from "lucide-react";
import { CatalogView } from "@/components/catalog/catalog-view";
import { CategoryIcon, ProductImage } from "@/components/catalog/category-icon";
import { WhatsAppIcon } from "@/components/catalog/whatsapp-icon";
import { getCategoryDetail, getCompany, whatsappLink, type CatalogFilters } from "@/lib/queries/catalog";
import { formatMoney } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/catalog/[category]">) {
  const d = await getCategoryDetail((await params).category);
  return { title: d?.category.name ?? "Category", description: d?.category.description ?? undefined };
}

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-24 font-display text-[24px] font-bold uppercase tracking-tight text-ink-900">{children}</h2>
);

export default async function CategoryPage({ params, searchParams }: PageProps<"/catalog/[category]">) {
  const { category } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const [detail, company] = await Promise.all([getCategoryDetail(category), getCompany()]);
  if (!detail) notFound();
  const { category: c, comparison } = detail;
  const wa = whatsappLink(company?.whatsapp_number, `Hello, I'd like advice and pricing on ${c.name}.`);
  const paragraphs = (c.overview ?? c.description ?? "").split(/\n\s*\n/).filter(Boolean);
  const nav = [
    ["products", "Products"], ["overview", "Overview"],
    ...(c.applications.length ? [["applications", "Applications"]] : []),
    ...(c.buying_guide.length ? [["guide", "How to choose"]] : []),
    ...(comparison.rows.length > 1 ? [["compare", "Compare models"]] : []),
    ...(c.faqs.length ? [["faq", "FAQs"]] : []),
  ];

  return (
    <div className="bg-page">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0a0d14_0%,#1b1f27_100%)] text-white">
        <div className="container-site grid items-center gap-8 py-9 md:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <nav className="mb-3 text-xs text-white/60"><Link href="/" className="hover:text-white">Home</Link> / <Link href="/categories" className="hover:text-white">Categories</Link> / <span className="text-white/90">{c.name}</span></nav>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#3a95f7]">Equipment category</p>
            <h1 className="mt-2 font-display text-[38px] font-bold uppercase leading-[1.05] tracking-tight">{c.name}</h1>
            {c.description && <p className="mt-3 text-[15px] text-white/80">{c.description}.</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#products" className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-brand-600">View products <ArrowRight className="h-4 w-4" /></a>
              <Link href="/contact" className="inline-flex h-10 items-center gap-2 rounded-sm border border-white/40 px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-white/10">Get enquiry</Link>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-sm bg-[#25D366] px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-[#1fb757]"><WhatsAppIcon className="h-4 w-4" />WhatsApp</a>}
            </div>
          </div>
          <div className="hidden h-[190px] w-[300px] items-center justify-center rounded-md bg-white/95 p-4 md:flex">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" />
            ) : <CategoryIcon slug={c.slug} className="h-20 w-20 text-navy/40" />}
          </div>
        </div>
      </section>

      <div className="sticky top-[60px] z-30 border-b border-line bg-white/95 backdrop-blur">
        <nav className="container-site flex gap-6 overflow-x-auto text-[12px] font-bold uppercase tracking-wide">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="whitespace-nowrap border-b-2 border-transparent py-3 text-ink-900 hover:border-brand hover:text-brand">{label}</a>)}
        </nav>
      </div>

      <CatalogView filters={sp as CatalogFilters} basePath={`/catalog/${c.slug}`} title={`${c.name} — products`} lockedCategory={c.slug} embedded />

      <div className="container-site space-y-14 pb-14 pt-6">
        {/* Overview */}
        <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <H2 id="overview">About {c.name.toLowerCase()}</H2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[#3d4652]">
              {paragraphs.length ? paragraphs.map((p) => <p key={p.slice(0, 30)}>{p}</p>) : <p>Contact our team for selection advice, pricing and availability.</p>}
            </div>
          </div>
          {c.key_points.length > 0 && (
            <div className="h-fit rounded-md border border-[#dde5ee] bg-white p-5">
              <h3 className="font-display text-lg font-bold uppercase text-ink-900">What we offer</h3>
              <ul className="mt-3 space-y-2.5">
                {c.key_points.map((k) => <li key={k} className="flex gap-2.5 text-[14px] text-[#3d4652]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{k}</li>)}
              </ul>
            </div>
          )}
        </section>

        {/* Applications */}
        {c.applications.length > 0 && (
          <section>
            <H2 id="applications">Applications</H2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {c.applications.map((a) => (
                <li key={a} className="flex items-center gap-3 rounded-md border border-[#dde5ee] bg-white px-4 py-3 text-[14px] font-semibold text-ink-900">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />{a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Buying guide */}
        {c.buying_guide.length > 0 && (
          <section className="rounded-md bg-band p-6 md:p-8">
            <H2 id="guide">How to choose the right {c.name.toLowerCase()}</H2>
            <ol className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {c.buying_guide.map((g, i) => (
                <li key={g.title} className="rounded-md border border-[#dde5ee] bg-white p-5">
                  <p className="flex items-center gap-2 text-[15px] font-bold text-ink-900"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">{i + 1}</span>{g.title}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#3d4652]">{g.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-2 text-sm text-[#3d4652]"><Lightbulb className="h-4 w-4 text-brand" />Not sure? <Link href="/contact" className="font-semibold text-brand hover:underline">Ask our application engineers</Link> — we&apos;ll recommend the right model for your site.</p>
          </section>
        )}

        {/* Comparison */}
        {comparison.rows.length > 1 && (
          <section>
            <H2 id="compare">Compare models</H2>
            <div className="mt-4 overflow-x-auto rounded-md border border-[#dde5ee] bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-navy text-left text-xs font-bold uppercase tracking-wider text-white">
                    <th className="px-4 py-3">Model</th><th className="px-4 py-3">Brand</th>
                    {comparison.columns.map((col) => <th key={col} className="px-4 py-3">{col}</th>)}
                    <th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((r, i) => (
                    <tr key={r.id} className={i % 2 ? "bg-band/50" : ""}>
                      <td className="px-4 py-3">
                        <Link href={`/products/${r.slug}`} className="flex items-center gap-3 font-semibold text-ink-900 hover:text-brand">
                          <span className="flex h-10 w-12 shrink-0 items-center justify-center">{r.image_url ? <ProductImage src={r.image_url} alt="" categorySlug={r.category_slug} /> : <CategoryIcon slug={r.category_slug} className="h-6 w-6 text-navy/40" />}</span>
                          <span>{r.name}<span className="block text-xs font-normal text-muted">{r.sku}</span></span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.brand_name ?? "—"}</td>
                      {comparison.columns.map((col) => <td key={col} className="px-4 py-3">{r.specs.find((s) => s.label === col)?.value ?? "—"}</td>)}
                      <td className="px-4 py-3 text-right font-semibold tnum">{r.display_price ? formatMoney(r.display_price).replace(/\.00$/, "") : <span className="text-brand">On request</span>}</td>
                      <td className="px-4 py-3 text-right"><Link href={`/products/${r.slug}`} className="text-xs font-bold uppercase tracking-wide text-brand hover:underline">Details</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* FAQs */}
        {c.faqs.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div><H2 id="faq">Frequently asked questions</H2><p className="mt-2 text-sm text-muted">Can&apos;t find your answer? Our team is a call or message away.</p></div>
            <div className="divide-y divide-line rounded-md border border-[#dde5ee] bg-white">
              {c.faqs.map((f, i) => (
                <details key={f.q} className="group px-5 py-4" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                    {f.q}<ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#3d4652]">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-md bg-footer px-6 py-6 text-white md:flex-row md:items-center">
          <div>
            <p className="font-display text-xl font-bold uppercase">Need help selecting {c.name.toLowerCase()}?</p>
            <p className="mt-1 text-sm text-white/75">Share your site details and we&apos;ll recommend the right model, with pricing and delivery.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-brand-600">Get enquiry <ArrowRight className="h-4 w-4" /></Link>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-sm bg-[#25D366] px-5 text-[12px] font-bold uppercase tracking-wide text-white"><WhatsAppIcon className="h-4 w-4" />WhatsApp</a>}
          </div>
        </section>
      </div>
    </div>
  );
}
