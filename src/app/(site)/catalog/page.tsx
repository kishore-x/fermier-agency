import { CatalogView } from "@/components/catalog/catalog-view";
import type { CatalogFilters } from "@/lib/queries/catalog";

export const metadata = { title: "Product catalog" };

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <CatalogView filters={sp as CatalogFilters & { focus?: string }} basePath="/catalog" title={sp.q ? `Results for “${sp.q}”` : "All products"} />;
}
