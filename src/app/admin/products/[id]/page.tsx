import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/ui/forms";
import { FileUploader } from "@/components/ui/file-uploader";
import { Alert, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/utils";
import { deleteProductFile, duplicateProduct, uploadProductFiles as uploadAction } from "../actions";
import { ProductForm } from "../product-form";

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const supabase = await createClient();
  const [{ data: p }, { data: categories }, { data: brands }, { data: specs }, { data: images }, { data: docs }, { data: cost }, { data: stock }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, parent_id").order("sort_order"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("product_specifications").select("spec_group, label, value").eq("product_id", id).order("sort_order"),
    supabase.from("product_images").select("id, url, alt").eq("product_id", id).order("sort_order"),
    supabase.from("product_documents").select("id, title, storage_path, size_bytes").eq("product_id", id),
    supabase.from("product_costs").select("purchase_cost").eq("product_id", id).maybeSingle(),
    supabase.from("inventory_overview").select("on_hand, reserved, available").eq("product_id", id).maybeSingle(),
  ]);
  if (!p) notFound();
  const manage = can.manageProducts(session);
  const docUrl = (path: string) => supabase.storage.from("product-documents").getPublicUrl(path).data.publicUrl;

  return (
    <div className="max-w-6xl">
      <PageHeader back={{ href: "/admin/products", label: "Products" }}
        title={<span className="flex items-center gap-3">{p.name} <StatusBadge status={p.status} /></span>}
        description={<>{p.sku} · Stock: {formatQty(stock?.on_hand)} on hand, {formatQty(stock?.reserved)} reserved, <strong>{formatQty(stock?.available)} available</strong></>}
        actions={<>
          {p.status === "active" && <LinkButton href={`/products/${p.slug}`} variant="outline" target="_blank"><ExternalLink className="h-4 w-4" />View in catalog</LinkButton>}
          <LinkButton href={`/admin/inventory/${p.id}`} variant="outline">Stock history</LinkButton>
          {manage && <ConfirmAction action={duplicateProduct} fields={{ id: p.id }} title="Duplicate product?" description="Creates a draft copy. Stock is not copied." trigger="Duplicate" confirmLabel="Duplicate" />}
        </>} />
      {sp.created && <Alert tone="success" className="mb-4">Product created. Add images and brochures below, then set the status to Active to publish it.</Alert>}
      {sp.duplicated && <Alert tone="success" className="mb-4">Draft copy created — update the SKU and name before activating.</Alert>}
      {!manage && <Alert className="mb-4">You have read-only access to the product master.</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ProductForm readOnly={!manage} categories={categories ?? []} brands={brands ?? []} showCost={can.viewCost(session)}
          values={{ ...p, purchase_cost: cost?.purchase_cost ?? "", specs: specs ?? [] }} />
        <div className="space-y-4">
          <Card>
            <CardHeader title="3. Product images" description="JPG, PNG or WebP · max 5 MB each" />
            <div className="space-y-3 p-4">
              {(images ?? []).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images!.map((img, i) => (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded border border-line bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-contain" />
                      {i === 0 && <span className="absolute left-1 top-1 rounded bg-navy px-1 text-[9px] text-white">Main</span>}
                      {manage && <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100">
                        <ConfirmAction action={deleteProductFile} fields={{ id: img.id, kind: "image" }} title="Remove image?" trigger={<Trash2 className="h-3.5 w-3.5" />} triggerVariant="outline" confirmLabel="Remove" tone="danger" />
                      </div>}
                    </div>
                  ))}
                </div>
              )}
              {manage && <FileUploader action={uploadAction} fields={{ product_id: p.id, kind: "image" }} accept="image/jpeg,image/png,image/webp" multiple label="Add images" hint="Drop or choose files" />}
            </div>
          </Card>
          <Card>
            <CardHeader title="7. Documents & brochures" description="PDF · max 15 MB" />
            <div className="space-y-3 p-4">
              <ul className="space-y-2 text-sm">
                {(docs ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <Link href={docUrl(d.storage_path)} target="_blank" className="flex items-center gap-2 truncate text-navy hover:underline"><FileText className="h-4 w-4 shrink-0" />{d.title}</Link>
                    {manage && <ConfirmAction action={deleteProductFile} fields={{ id: d.id, kind: "document" }} title="Remove document?" trigger={<Trash2 className="h-3.5 w-3.5" />} triggerVariant="ghost" confirmLabel="Remove" tone="danger" />}
                  </li>
                ))}
                {!docs?.length && <li className="text-muted">No documents yet.</li>}
              </ul>
              {manage && <FileUploader action={uploadAction} fields={{ product_id: p.id, kind: "document" }} accept="application/pdf" multiple label="Add brochure (PDF)" hint="Datasheets, manuals, brochures" />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
