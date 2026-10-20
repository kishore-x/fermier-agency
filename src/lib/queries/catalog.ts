import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange, searchTerm } from "@/lib/utils";

export type CatalogProduct = {
  id: string; sku: string; slug: string; name: string; model_number: string | null; short_description: string | null;
  display_price: string | null; price_visibility: "show_price" | "on_request"; unit: string; tax_rate: string;
  category_name: string | null; category_slug: string | null; brand_name: string | null; brand_slug: string | null;
  available_qty: string; image_url: string | null; is_featured: boolean; is_sample_data: boolean; featured_rank?: number;
};

export type CardSpec = { label: string; value: string };
export type CatalogCardProduct = CatalogProduct & { type: string | null; specs: CardSpec[] };

/** Adds the product "Type" and its first spec rows, for spec-sheet style product cards. */
export async function withCardSpecs(rows: CatalogProduct[], limit = 6): Promise<CatalogCardProduct[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("product_specifications").select("product_id, label, value, sort_order")
    .in("product_id", rows.map((r) => r.id)).order("sort_order");
  return rows.map((r) => {
    const mine = (data ?? []).filter((x) => x.product_id === r.id);
    return { ...r, type: mine.find((x) => x.label === "Type")?.value ?? null,
      specs: mine.filter((x) => x.label !== "Type").slice(0, limit).map((x) => ({ label: x.label, value: x.value })) };
  });
}

export type CatalogFilters = {
  q?: string; category?: string; brand?: string; availability?: string; sort?: string; min?: string; max?: string; page?: string; focus?: string;
};

export async function listCatalog(f: CatalogFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const { from, to, page } = pageRange(Number(f.page), pageSize);
  let q = supabase.from("catalog_products").select("*", { count: "exact" });
  const term = f.q ? searchTerm(f.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,model_number.ilike.%${term}%,brand_name.ilike.%${term}%`);
  if (f.category) q = q.eq("category_slug", f.category);
  if (f.brand) q = q.eq("brand_slug", f.brand);
  if (f.availability === "in_stock") q = q.gt("available_qty", 0);
  if (f.min && !isNaN(Number(f.min))) q = q.gte("display_price", Number(f.min));
  if (f.max && !isNaN(Number(f.max))) q = q.lte("display_price", Number(f.max));
  switch (f.sort) {
    case "price_asc": q = q.order("display_price", { ascending: true, nullsFirst: false }); break;
    case "price_desc": q = q.order("display_price", { ascending: false, nullsFirst: false }); break;
    case "newest": q = q.order("created_at", { ascending: false }); break;
    case "name": q = q.order("name"); break;
    default: q = q.order("is_featured", { ascending: false }).order("featured_rank").order("name");
  }
  const { data, count, error } = await q.range(from, to);
  if (error) throw error;
  return { rows: await withCardSpecs((data ?? []) as CatalogProduct[]), total: count ?? 0, page, pageSize };
}

export const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, description, image_url, sort_order")
    .eq("is_active", true).is("parent_id", null).order("sort_order");
  return data ?? [];
});

export const getBrands = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name, slug, logo_url").eq("is_active", true).order("name");
  return data ?? [];
});

export async function getFeatured(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.from("catalog_products").select("*").eq("is_featured", true).order("featured_rank").order("name").limit(limit);
  const rows = (data ?? []) as CatalogProduct[];
  const { data: specs } = await supabase.from("product_specifications").select("product_id, label, value, sort_order")
    .in("product_id", rows.map((r) => r.id)).order("sort_order");
  return rows.map((r) => {
    const mine = (specs ?? []).filter((x) => x.product_id === r.id);
    const type = mine.find((x) => x.label === "Type")?.value ?? null;
    return { ...r, type, spec_line: mine.filter((x) => x.label !== "Type").slice(0, type ? 2 : 3).map((x) => x.value) };
  });
}

export async function getProductBySlug(slug: string) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("catalog_products").select("*").eq("slug", slug).maybeSingle();
  if (!p) return null;
  const [{ data: images }, { data: specs }, { data: docs }, { data: related }, { data: cat }] = await Promise.all([
    supabase.from("product_images").select("id, url, alt").eq("product_id", p.id).order("sort_order"),
    supabase.from("product_specifications").select("spec_group, label, value").eq("product_id", p.id).order("sort_order"),
    supabase.from("product_documents").select("id, title, storage_path, file_type").eq("product_id", p.id),
    supabase.from("catalog_products").select("*").eq("category_slug", p.category_slug).neq("id", p.id).limit(4),
    supabase.from("categories").select("applications").eq("id", p.category_id).maybeSingle(),
  ]);
  // Products without their own application list inherit their category's.
  if (!p.applications?.length && cat?.applications?.length) p.applications = cat.applications;
  return {
    product: p as CatalogProduct & { description: string | null; manufacturer: string | null; features: string[]; applications: string[];
      in_the_box: string[]; warranty: string | null; hsn_code: string | null },
    images: images ?? [], specs: specs ?? [], docs: docs ?? [], related: await withCardSpecs((related ?? []) as CatalogProduct[]),
  };
}

export const getCompany = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return data as null | {
    company_name: string; legal_name: string | null; address: string | null; phone: string | null; email: string | null;
    whatsapp_number: string | null; gstin: string | null; logo_url: string | null; default_terms: string | null;
    approval_discount_pct: string; approval_amount_threshold: string; invoice_stage: string; quotation_validity_days: number;
    allow_negative_stock: boolean; timezone: string; currency: string;
  };
});

export function whatsappLink(number: string | null | undefined, text: string) {
  const n = (number ?? "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export type CategoryDetail = {
  id: string; name: string; slug: string; description: string | null; image_url: string | null; overview: string | null;
  key_points: string[]; applications: string[]; buying_guide: { title: string; text: string }[]; faqs: { q: string; a: string }[];
};

/** Category landing-page content plus a spec comparison across every active product in it. */
export async function getCategoryDetail(slug: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("categories")
    .select("id, name, slug, description, image_url, overview, key_points, applications, buying_guide, faqs").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!c) return null;
  const { data: prods } = await supabase.from("catalog_products").select("*").eq("category_slug", slug).order("featured_rank").order("name").limit(50);
  const rows = await withCardSpecs((prods ?? []) as CatalogProduct[], 50);
  const freq = new Map<string, number>();
  rows.forEach((r) => r.specs.forEach((s) => freq.set(s.label, (freq.get(s.label) ?? 0) + 1)));
  const columns = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l);
  return { category: c as CategoryDetail, comparison: { columns, rows } };
}
