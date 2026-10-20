import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { getCategories, type CatalogFilters } from "@/lib/queries/catalog";

export default async function CategoryPage({ params, searchParams }: PageProps<"/catalog/[category]">) {
  const { category } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const cat = (await getCategories()).find((c) => c.slug === category);
  if (!cat) notFound();
  return <CatalogView filters={sp as CatalogFilters} basePath={`/catalog/${cat.slug}`} title={cat.name} lockedCategory={cat.slug} />;
}
