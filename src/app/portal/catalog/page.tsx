import { CatalogView } from "@/components/catalog/catalog-view";
import type { CatalogFilters } from "@/lib/queries/catalog";

export const metadata = { title: "Catalog" };

export default async function PortalCatalog({ searchParams }: PageProps<"/portal/catalog">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <div className="-mx-4 -my-6"><CatalogView filters={sp as CatalogFilters} basePath="/portal/catalog" title={sp.q ? `Results for “${sp.q}”` : "Order from the catalog"} /></div>;
}
