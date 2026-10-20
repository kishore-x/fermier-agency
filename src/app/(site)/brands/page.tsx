import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/catalog/page-hero";
import { getBrands } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const brands = await getBrands();
  const supabase = await createClient();
  const { data: counts } = await supabase.from("catalog_products").select("brand_slug");
  const n = (slug: string) => (counts ?? []).filter((c) => c.brand_slug === slug).length;
  return (
    <div className="bg-page pb-12">
      <PageHero eyebrow="Our brands" title="Global brands, local support" text="Equipment from internationally recognised manufacturers, backed by our sales, service and spares team." />
      <div className="container-site grid grid-cols-2 gap-3 pt-8 sm:grid-cols-3 lg:grid-cols-4">
        {[...brands].sort((a, b) => Number(!!b.logo_url) - Number(!!a.logo_url)).map((b) => (
          <Link key={b.id} href={`/catalog?brand=${b.slug}`} className="group flex flex-col items-center rounded-sm border border-[#e3e8ef] bg-white p-5 text-center transition-shadow hover:shadow-md">
            <div className="flex h-20 items-center justify-center">
              {b.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_url} alt={b.name} className="max-h-full max-w-[180px] object-contain mix-blend-multiply" />
              ) : <span className="font-display text-2xl font-bold uppercase text-ink-900">{b.name}</span>}
            </div>
            <p className="mt-3 text-xs text-muted">{n(b.slug)} product{n(b.slug) === 1 ? "" : "s"}</p>
            <span className="mt-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand">View products <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </div>
      <p className="container-site mt-6 text-xs text-muted">Brand names and logos are trademarks of their respective owners.</p>
    </div>
  );
}
