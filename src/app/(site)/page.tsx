import Link from "next/link";
import { ArrowRight, BadgeCheck, FileText, Headset, Truck, Wrench } from "lucide-react";
import { CategoryCard, ProductCard } from "@/components/catalog/product-card";
import { LinkButton } from "@/components/ui/primitives";
import { getBrands, getCategories, getFeatured } from "@/lib/queries/catalog";

export default async function HomePage() {
  const [categories, featured, brands] = await Promise.all([getCategories(), getFeatured(8), getBrands()]);
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-6 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Construction · Lifting · Power · Agri</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
              Site-ready equipment, quoted fast and delivered on schedule.
            </h1>
            <p className="mt-3 max-w-xl text-white/75">
              Browse winches, generators, compressors, pressure washers and more. Add items to your cart and get a formal quotation from our sales team.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/catalog" variant="success" size="lg">Browse catalog <ArrowRight className="h-4 w-4" /></LinkButton>
              <LinkButton href="/register" variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                Open a trade account
              </LinkButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["500 kg winches", "Eco & Plus models", "/catalog/lifting-equipment"],
              ["Generators", "3 – 7.5 kVA", "/catalog/generators"],
              ["Pressure washers", "Workshop & site", "/catalog/pressure-washers"],
              ["Power weeders", "Agri & garden", "/catalog/agriculture-garden-equipment"],
            ].map(([t, s, href]) => (
              <Link key={t} href={href} className="rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-white/60">{s}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <SectionTitle title="Shop by category" href="/catalog" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {categories.map((c) => <CategoryCard key={c.id} c={c} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4">
        <SectionTitle title="Featured products" href="/catalog?sort=featured" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 rounded-lg border border-line bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mx-auto max-w-7xl px-4 py-4">
        <SectionTitle title="Brands we distribute" />
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <Link key={b.id} href={`/catalog?brand=${b.slug}`} className="flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:border-navy/40">
              <BadgeCheck className="h-4 w-4 text-brand" /> {b.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
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

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {href && <Link href={href} className="text-sm font-medium text-navy hover:underline">View all</Link>}
    </div>
  );
}
