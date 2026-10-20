import Link from "next/link";
import { ArrowRight, BadgeCheck, Cog, FileText, Headset, ShieldCheck, Truck, Wrench } from "lucide-react";
import { AddToCartButton } from "@/components/catalog/add-to-cart";
import { CategoryIcon, ProductImage } from "@/components/catalog/category-icon";
import { LinkButton } from "@/components/ui/primitives";
import { getBrands, getCategories, getFeatured, type CatalogProduct } from "@/lib/queries/catalog";

const QUICK = [
  { title: "500 kg winches", sub: "Eco & Plus models", href: "/catalog/lifting-equipment", img: "/demo/quick-winch.jpg" },
  { title: "Generators", sub: "3 – 7.5 kVA", href: "/catalog/generators", img: "/demo/quick-generator.jpg" },
  { title: "Pressure washers", sub: "Workshop & site", href: "/catalog/pressure-washers", img: "/demo/quick-washer.jpg" },
  { title: "Power weeders", sub: "Agri & garden", href: "/catalog/agriculture-garden-equipment", img: "/demo/quick-weeder.jpg" },
];

const TRUST = [
  { icon: Truck, title: "Fast Quotation", sub: "Get quotes quickly" },
  { icon: ShieldCheck, title: "Trusted Brands", sub: "Genuine & reliable" },
  { icon: Cog, title: "Wide Range", sub: "Construction to Agri" },
  { icon: Headset, title: "Expert Support", sub: "Pre & post sales" },
];

export default async function HomePage() {
  const [categories, featured, brands] = await Promise.all([getCategories(), getFeatured(4), getBrands()]);
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demo/hero.jpg" alt="" className="absolute inset-y-0 right-0 hidden h-full w-[62%] object-cover object-right md:block" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#191A3D_38%,rgba(25,26,61,0.92)_48%,rgba(25,26,61,0.35)_68%,rgba(25,26,61,0)_85%)] md:block" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_272px] md:py-12 lg:grid-cols-[minmax(0,580px)_272px_1fr]">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand">Construction · Lifting · Power · Agri</p>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.12] tracking-tight md:text-[42px]">
              Site-ready equipment, quoted fast and delivered on schedule.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
              Browse winches, generators, compressors, pressure washers and more. Add items to your cart and get a formal quotation from our sales team.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/catalog" variant="success" size="lg" className="rounded-md px-7">Browse catalog <ArrowRight className="h-4 w-4" /></LinkButton>
              <LinkButton href="/register" variant="outline" size="lg" className="rounded-md border-white/40 bg-transparent px-7 text-white hover:bg-white/10">Open a trade account</LinkButton>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-y-4 sm:flex sm:flex-nowrap sm:items-center">
              {TRUST.map((t, i) => (
                <li key={t.title} className={`flex shrink-0 items-center gap-2 sm:pr-3.5 ${i > 0 ? "sm:border-l sm:border-white/15 sm:pl-3.5" : ""}`}>
                  <t.icon className="h-6 w-6 shrink-0 text-white/90" strokeWidth={1.5} />
                  <span><span className="block whitespace-nowrap text-xs font-semibold">{t.title}</span><span className="block whitespace-nowrap text-[10.5px] text-white/60">{t.sub}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-3">
            {QUICK.map((q) => (
              <Link key={q.title} href={q.href} className="group flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.06] p-2.5 pr-4 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.12]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.img} alt="" className="h-14 w-16 shrink-0 rounded object-cover" />
                <span className="flex-1"><span className="block text-[15px] font-semibold">{q.title}</span><span className="block text-xs text-white/65">{q.sub}</span></span>
                <ArrowRight className="h-4 w-4 text-white/80 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
        <SectionTitle title="Shop by category" href="/catalog" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.slice(0, 6).map((c) => (
            <Link key={c.id} href={`/catalog/${c.slug}`} className="group flex flex-col rounded-lg border border-line bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
              <div className="flex h-24 items-center justify-center">
                {c.image_url
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" />
                  : <CategoryIcon slug={c.slug} className="h-12 w-12 text-navy/50" />}
              </div>
              <div className="mt-2 flex items-end justify-between gap-2 px-1">
                <span className="text-[15px] font-semibold leading-snug text-ink">{c.name}</span>
                <ArrowRight className="mb-0.5 h-4 w-4 shrink-0 text-ink transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 pt-9">
        <SectionTitle title="Featured products" href="/catalog?sort=featured" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((p) => <FeaturedCard key={p.id} p={p} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10">
        <div className="grid gap-5 rounded-lg border border-line bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [FileText, "Formal quotations", "GST-ready quotations with validity and terms."],
            [Truck, "Dispatch tracking", "Track order and dispatch status online."],
            [Wrench, "After-sales support", "Spares and service through our network."],
            [Headset, "Dedicated sales contact", "A named salesperson for every account."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof FileText;
            return (
              <div key={t as string} className="flex gap-3">
                <I className="h-6 w-6 shrink-0 text-brand" strokeWidth={1.75} />
                <div><p className="text-sm font-semibold">{t as string}</p><p className="text-sm text-muted">{d as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-9">
        <SectionTitle title="Brands we distribute" />
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <Link key={b.id} href={`/catalog?brand=${b.slug}`} className="flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:border-navy/40">
              <BadgeCheck className="h-4 w-4 text-brand" /> {b.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col items-start justify-between gap-4 rounded-lg bg-brand px-6 py-6 text-white sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-semibold">Buying for a project?</p>
            <p className="text-sm text-white/85">Add everything you need to the cart and request a single consolidated quotation.</p>
          </div>
          <LinkButton href="/catalog" className="bg-white text-brand-600 hover:bg-white/90">Start an enquiry</LinkButton>
        </div>
      </section>
    </>
  );
}

function FeaturedCard({ p }: { p: CatalogProduct & { spec_line: string[] } }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
      <Link href={`/products/${p.slug}`} className="flex h-[136px] w-[112px] shrink-0 items-center justify-center">
        <ProductImage src={p.image_url} alt={p.name} categorySlug={p.category_slug} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <Link href={`/products/${p.slug}`} className="text-sm font-bold leading-snug text-ink hover:text-navy">{p.name}</Link>
        {p.spec_line.length > 0 && <p className="mt-1.5 text-xs text-muted">{p.spec_line.join("  |  ")}</p>}
        {p.short_description && <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted">{p.short_description}</p>}
        <AddToCartButton product={p} label="Request quote" arrow compact className="mt-auto w-full pt-3" />
      </div>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {href && <Link href={href} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">View all <ArrowRight className="h-4 w-4" /></Link>}
    </div>
  );
}
