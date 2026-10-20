import Link from "next/link";
import { ArrowRight, BookOpenCheck, Cog, Globe2, Network, Package, Quote, Settings2, ShieldCheck, Users, Wrench } from "lucide-react";
import { CategoryIcon, ProductImage } from "@/components/catalog/category-icon";
import { getBrands, getCategories, getFeatured, type CatalogProduct } from "@/lib/queries/catalog";
import { SITE } from "@/lib/site-content";

const STAT_ICON = { cog: Settings2, box: Package, globe: Globe2, users: Users } as const;
const REASON_ICON = { range: Network, globe: Globe2, service: Wrench, parts: Cog, guide: BookOpenCheck, shield: ShieldCheck } as const;

const Eyebrow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[11.5px] font-bold uppercase tracking-[0.08em] text-brand ${className}`}>{children}</p>
);
const Heading = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-display text-[26px] font-bold uppercase leading-[1.08] tracking-tight text-ink-900 ${className}`}>{children}</h2>
);
const ViewAll = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand hover:underline">{children} <ArrowRight className="h-3.5 w-3.5" /></Link>
);

export default async function HomePage() {
  const [categories, featured, brands] = await Promise.all([getCategories(), getFeatured(6), getBrands()]);
  const order = ["masalta", "wacker-neuson", "bomag", "mikasa", "belle", "dynapac"];
  const logoBrands = brands.filter((b) => b.logo_url).sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)).slice(0, 6);
  return (
    <div className="bg-page">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0a0d14_0%,#12151c_45%,#2a2e36_80%,#4a4e58_100%)] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/hero.jpg" alt="Power trowel on a concrete site floor"
          className="pointer-events-none absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-[30%] opacity-35 [mask-image:linear-gradient(90deg,transparent,black_14%,black_86%,transparent)] md:-translate-x-[38%] md:opacity-100" />
        <div className="relative mx-auto flex min-h-[250px] max-w-[1200px] items-center px-4 py-7">
          <div className="max-w-[420px]">
            <Eyebrow className="text-[#3a95f7]">{SITE.hero.eyebrow}</Eyebrow>
            <h1 className="mt-2 font-display text-[36px] font-bold leading-[1.06] tracking-tight">
              {SITE.hero.title.map((l) => <span key={l} className="block">{l}</span>)}
            </h1>
            <p className="mt-3 text-[13.5px] leading-snug text-white/85">{SITE.hero.text}</p>
            <Link href="/contact" className="mt-5 inline-flex h-9 items-center gap-2 rounded-sm bg-brand px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-brand-600">
              Get enquiry <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="ml-auto hidden space-y-3.5 lg:block">
            <li className="mb-5 h-px w-4 bg-white/80" aria-hidden />
            {SITE.hero.services.map((s) => (
              <li key={s}><Link href="/services" className="text-[12.5px] font-bold uppercase tracking-wide text-white/95 hover:text-[#3a95f7]">{s}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-charcoal text-white">
        <ul className="mx-auto grid max-w-[1200px] grid-cols-2 px-4 md:grid-cols-4">
          {SITE.stats.map((s, i) => {
            const I = STAT_ICON[s.icon as keyof typeof STAT_ICON];
            return (
              <li key={s.label} className={`flex items-center justify-center gap-5 py-3 ${i > 0 ? "md:border-l md:border-white/20" : ""}`}>
                <I className="h-6 w-6 text-white/85" strokeWidth={1.4} />
                <span className="hidden h-7 w-px bg-white/20 sm:block" />
                <span><span className="block font-display text-[20px] font-bold leading-none">{s.value}</span><span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-wider text-white/80">{s.label}</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* About + brands */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-6 lg:grid-cols-[250px_1fr_1px_480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/about.jpg" alt="Operator finishing a concrete floor with a power trowel" className="h-[170px] w-full rounded-sm object-cover shadow-md" />
        <div>
          <Eyebrow>About us</Eyebrow>
          <Heading className="mt-2">{SITE.about.title.map((t) => <span key={t} className="block">{t}</span>)}</Heading>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#5b6472]">{SITE.about.text}</p>
          <Link href="/about" className="mt-4 inline-flex h-8 items-center gap-2 rounded-sm border border-brand px-4 text-[11px] font-bold uppercase tracking-wide text-brand hover:bg-brand-50">
            Know more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="hidden h-[150px] bg-line lg:block" />
        <div>
          <div className="mb-3 flex items-center justify-between"><Eyebrow>Our brands</Eyebrow><ViewAll href="/brands">View all brands</ViewAll></div>
          <div className="grid grid-cols-3">
            {logoBrands.map((b, i) => (
              <Link key={b.id} href={`/catalog?brand=${b.slug}`} title={b.name}
                className={`flex h-[66px] items-center justify-center px-3 transition-opacity hover:opacity-80 ${i % 3 !== 2 ? "border-r border-line" : ""} ${i < 3 ? "border-b border-line" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.logo_url!} alt={b.name} className="max-h-[52px] max-w-full object-contain" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-band">
        <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-6 lg:grid-cols-[210px_1fr] lg:items-center">
          <div><Eyebrow>Why choose us</Eyebrow><Heading className="mt-1.5">Precision meets reliability</Heading></div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {SITE.reasons.map((r) => {
              const I = REASON_ICON[r.icon as keyof typeof REASON_ICON];
              return (
                <div key={r.title} className="rounded-sm border border-[#dde5ee] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(14,27,44,0.05)]">
                  <I className="h-6 w-6 text-brand" strokeWidth={1.5} />
                  <p className="mt-2 text-[12.5px] font-bold text-ink-900">{r.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#5b6472]">{r.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto grid max-w-[1200px] gap-5 px-4 py-5 lg:grid-cols-[150px_1fr]">
        <div className="lg:pt-6"><Eyebrow>Explore our range</Eyebrow><Heading className="mt-1.5">Equipment categories</Heading></div>
        <div>
          <div className="mb-1.5 flex justify-end"><ViewAll href="/categories">View all categories</ViewAll></div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} href={`/catalog/${c.slug}`} className="group flex flex-col rounded-sm border border-[#e3e8ef] bg-white p-3 shadow-[0_1px_2px_rgba(14,27,44,0.05)] transition-shadow hover:shadow-md">
                <div className="flex h-[78px] items-center justify-center">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" />
                  ) : <CategoryIcon slug={c.slug} className="h-10 w-10 text-navy/50" />}
                </div>
                <p className="mt-2 min-h-[30px] text-[11px] font-bold leading-tight text-ink-900">{c.name}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-sm border border-brand/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand group-hover:bg-brand-50">
                  Explore <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured machinery */}
      <section className="bg-band">
        <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-5 lg:grid-cols-[170px_1fr]">
          <div className="lg:pt-6"><Eyebrow>Featured machinery</Eyebrow><p className="mt-2 text-[14px] leading-snug text-[#3d4652]">Popular models from trusted international brands.</p></div>
          <div>
            <div className="mb-1.5 flex justify-end"><ViewAll href="/catalog?sort=featured">View all products</ViewAll></div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
              {featured.map((p) => <MachineCard key={p.id} p={p} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Clients */}
      <section className="mx-auto grid max-w-[1200px] gap-5 px-4 py-5 lg:grid-cols-[250px_1fr] lg:items-center">
        <div>
          <Eyebrow>Our clients</Eyebrow>
          <Heading className="mt-1.5">Trusted by industry leaders</Heading>
          <p className="mt-2 text-[12px] leading-snug text-[#5b6472]">Delivering reliable equipment and support across India and overseas.</p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          {SITE.testimonials.map((t) => (
            <figure key={t.quote} className="flex gap-2 rounded-sm border border-[#e3e8ef] bg-white p-3">
              <Quote className="h-4 w-4 shrink-0 rotate-180 fill-brand text-brand" />
              <div>
                <blockquote className="text-[11px] leading-snug text-[#3d4652]">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-2.5 text-[10.5px]"><span className="block font-semibold text-ink-900">— {t.name}</span><span className="block font-semibold text-brand">{t.company}</span></figcaption>
              </div>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden bg-footer text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/cta-left.jpg" alt="" className="absolute inset-y-0 left-0 hidden h-full w-[36%] object-cover [mask-image:linear-gradient(90deg,black_70%,transparent)] md:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/cta-right.jpg" alt="" className="absolute inset-y-0 right-0 hidden h-full w-[29%] object-cover [mask-image:linear-gradient(270deg,black_70%,transparent)] md:block" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-4 py-5 md:flex-row md:items-center md:pl-[25%] md:pr-[16%]">
          <div className="flex-1">
            <p className="font-display text-[17px] font-bold uppercase leading-tight tracking-wide">Industrial equipment<br />for a stronger tomorrow</p>
            <p className="mt-2 text-[11.5px] text-white/75">Get in touch with our team for the right equipment, pricing and support for your next project.</p>
          </div>
          <Link href="/contact" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-sm bg-brand px-5 text-[11.5px] font-bold uppercase tracking-wide text-white hover:bg-brand-600">
            Get enquiry <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function MachineCard({ p }: { p: CatalogProduct & { spec_line: string[]; type: string | null } }) {
  return (
    <Link href={`/products/${p.slug}`} className="group flex min-w-0 flex-col rounded-sm border border-[#dde5ee] bg-white px-2.5 py-3 shadow-[0_1px_2px_rgba(14,27,44,0.05)] transition-shadow hover:shadow-md">
      <div className="flex h-[78px] items-center justify-center"><ProductImage src={p.image_url} alt={p.name} categorySlug={p.category_slug} /></div>
      <p className="mt-2.5 truncate text-[11px] font-bold leading-tight text-ink-900" title={p.name}>{p.name}</p>
      {p.type && <p className="text-[11.5px] text-[#3d4652]">{p.type}</p>}
      {p.spec_line.length > 0 && <p className="mb-2.5 mt-0.5 text-[10.5px] text-muted">{p.spec_line.join("  |  ")}</p>}
      <span className="mt-auto flex h-7 translate-y-0 items-center justify-between rounded-sm bg-[#dce2e7] px-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-900 group-hover:bg-brand group-hover:text-white">
        <span className="flex-1 text-center">View details</span><ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
