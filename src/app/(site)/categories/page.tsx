import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { PageHero } from "@/components/catalog/page-hero";
import { getCategories } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Equipment categories" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  const supabase = await createClient();
  const { data: counts } = await supabase.from("catalog_products").select("category_slug");
  const n = (slug: string) => (counts ?? []).filter((c) => c.category_slug === slug).length;
  return (
    <div className="bg-page pb-12">
      <PageHero eyebrow="Explore our range" title="Equipment categories" text="Construction, compaction, concrete, power, lifting, material handling and agricultural equipment." />
      <div className="container-site grid grid-cols-2 gap-3 pt-8 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link key={c.id} href={`/catalog/${c.slug}`} className="group flex flex-col rounded-sm border border-[#e3e8ef] bg-white p-4 transition-shadow hover:shadow-md">
            <div className="flex h-32 items-center justify-center">
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" />
              ) : <CategoryIcon slug={c.slug} className="h-14 w-14 text-navy/40" />}
            </div>
            <p className="mt-3 text-sm font-bold text-ink-900">{c.name}</p>
            {c.description && <p className="mt-1 text-xs text-muted">{c.description}</p>}
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted">{n(c.slug)} product{n(c.slug) === 1 ? "" : "s"}</span>
              <span className="flex items-center gap-1 font-bold uppercase tracking-wide text-brand">Explore <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
