"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { can, requireStaff } from "@/lib/auth";
import { CSV_COLUMNS, parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { slugify, str } from "@/lib/utils";

const money = z.string().regex(/^$|^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (max 2 decimals)");

const productSchema = z.object({
  sku: z.string().min(2, "SKU is required").max(40).regex(/^[A-Za-z0-9._\-/]+$/, "Letters, numbers, - . _ / only"),
  name: z.string().min(2, "Name is required").max(200),
  slug: z.string().max(200).regex(/^$|^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  brand_id: z.string(), manufacturer: z.string().max(120), category_id: z.string().uuid("Choose a category"), subcategory_id: z.string(),
  model_number: z.string().max(80), short_description: z.string().max(300), description: z.string().max(10000),
  unit: z.string().min(1).max(20), selling_price: money, purchase_cost: money,
  tax_rate: z.string().regex(/^\d{1,2}(\.\d{1,2})?$|^100$/, "0–100"), hsn_code: z.string().max(12),
  price_visibility: z.enum(["show_price", "on_request"]), reorder_threshold: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a number"),
  is_featured: z.boolean(), status: z.enum(["draft", "active", "inactive", "archived"]),
});

export async function saveProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("admin");
  const id = str(fd.get("id")) || null;
  const raw = Object.fromEntries(Object.keys(productSchema.shape).map((k) => [k, k === "is_featured" ? fd.get(k) === "on" : str(fd.get(k))]));
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const v = parsed.data;
  const specs = JSON.parse(str(fd.get("specs")) || "[]") as { spec_group: string; label: string; value: string }[];
  if (!Array.isArray(specs) || specs.length > 100) return { error: "Too many specification rows." };
  const supabase = await createClient();
  const { purchase_cost, ...product } = v;
  const { data, error } = await supabase.rpc("save_product", {
    p_id: id, p: { ...product, slug: v.slug || slugify(`${v.name}-${v.sku}`) },
    p_specs: specs.map((s) => ({ spec_group: String(s.spec_group ?? "").slice(0, 60), label: String(s.label ?? "").slice(0, 120), value: String(s.value ?? "").slice(0, 300) })),
    p_cost: purchase_cost ? Number(purchase_cost) : null, p_set_cost: can.viewCost(session),
  });
  if (error) return { error: friendlyError(error) };
  const lines = (k: string) => str(fd.get(k)).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => l.slice(0, 200));
  const { error: cErr } = await supabase.from("products").update({
    features: lines("features"), applications: lines("applications"), in_the_box: lines("in_the_box"), warranty: str(fd.get("warranty")).slice(0, 500) || null,
  }).eq("id", data as string);
  if (cErr) return { error: friendlyError(cErr) };
  revalidatePath("/admin/products");
  revalidatePath("/catalog", "layout");
  revalidatePath("/products/[slug]", "page");
  if (!id) redirect(`/admin/products/${data}?created=1`);
  return { ok: true, message: "Product saved" };
}

export async function setProductStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const status = str(fd.get("status"));
  if (!["draft", "active", "inactive", "archived"].includes(status)) return { error: "Invalid status" };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", str(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/products");
  return { ok: true, message: `Product ${status === "active" ? "activated" : status}` };
}

export async function duplicateProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_product", { p_id: str(fd.get("id")) });
  if (error) return { error: friendlyError(error) };
  redirect(`/admin/products/${data}?duplicated=1`);
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["application/pdf"];

export async function uploadProductFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const productId = str(fd.get("product_id"));
  const kind = str(fd.get("kind")) as "image" | "document";
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one file." };
  if (files.length > 10) return { error: "Upload up to 10 files at a time." };
  const allowed = kind === "image" ? IMAGE_TYPES : DOC_TYPES;
  const maxBytes = kind === "image" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
  for (const f of files) {
    if (!allowed.includes(f.type)) return { error: `${f.name}: unsupported file type. Allowed: ${kind === "image" ? "JPG, PNG, WebP" : "PDF"}.` };
    if (f.size > maxBytes) return { error: `${f.name} is larger than ${maxBytes / 1024 / 1024} MB.` };
  }
  const supabase = await createClient();
  const bucket = kind === "image" ? "product-images" : "product-documents";
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  let order = count ?? 0;
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, { contentType: f.type, upsert: false });
    if (upErr) return { error: `Upload failed for ${f.name}: ${upErr.message}` };
    if (kind === "image") {
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("product_images").insert({ product_id: productId, url, storage_path: path, alt: f.name, sort_order: ++order });
      if (error) return { error: friendlyError(error) };
    } else {
      const { error } = await supabase.from("product_documents").insert({
        product_id: productId, title: f.name.replace(/\.pdf$/i, ""), storage_path: path, file_type: f.type, size_bytes: f.size,
      });
      if (error) return { error: friendlyError(error) };
    }
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: `${files.length} file(s) uploaded` };
}

export async function deleteProductFile(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const supabase = await createClient();
  const kind = str(fd.get("kind"));
  const table = kind === "image" ? "product_images" : "product_documents";
  const bucket = kind === "image" ? "product-images" : "product-documents";
  const { data: row } = await supabase.from(table).select("storage_path, product_id").eq("id", str(fd.get("id"))).single();
  if (!row) return { error: "File not found" };
  const { error } = await supabase.from(table).delete().eq("id", str(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  if (row.storage_path) await supabase.storage.from(bucket).remove([row.storage_path]);
  revalidatePath(`/admin/products/${row.product_id}`);
  return { ok: true, message: "File removed" };
}

// ---------- CSV import ----------

const csvRow = z.object({
  sku: z.string().min(2, "SKU required").max(40).regex(/^[A-Za-z0-9._\-/]+$/, "invalid characters in SKU"),
  name: z.string().min(2, "name required").max(200),
  category_slug: z.string().min(1, "category_slug required"),
  brand_name: z.string().max(80), model_number: z.string().max(80), unit: z.string().max(20),
  selling_price: money, purchase_cost: money,
  tax_rate: z.string().regex(/^$|^\d{1,2}(\.\d{1,2})?$|^100$/, "tax_rate must be 0–100"), hsn_code: z.string().max(12),
  price_visibility: z.enum(["", "show_price", "on_request"], { message: "price_visibility must be show_price or on_request" }),
  reorder_threshold: z.string().regex(/^$|^\d{1,8}(\.\d{1,2})?$/, "reorder_threshold must be a number"),
  status: z.enum(["", "draft", "active", "inactive"], { message: "status must be draft, active or inactive" }),
  short_description: z.string().max(300), description: z.string().max(10000),
  opening_stock: z.string().regex(/^$|^\d{1,8}(\.\d{1,2})?$/, "opening_stock must be a non-negative number"),
});

export type ImportResult = null | (NonNullable<ActionState> & { rowErrors?: { row: number; sku: string; errors: string[] }[]; summary?: { created: number; updated: number } });

export async function importProductsCsv(_: ImportResult, fd: FormData): Promise<ImportResult> {
  await requireStaff("admin");
  const file = fd.get("file");
  const mode = str(fd.get("mode")) === "upsert" ? "upsert" : "create_only";
  if (!(file instanceof File) || !file.size) return { error: "Choose a CSV file." };
  if (file.size > 2 * 1024 * 1024) return { error: "CSV must be under 2 MB." };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file has no data rows." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["sku", "name", "category_slug"].filter((c) => !header.includes(c));
  if (missing.length) return { error: `Missing required column(s): ${missing.join(", ")}` };
  const unknown = header.filter((h) => !(CSV_COLUMNS as readonly string[]).includes(h));
  if (rows.length - 1 > 2000) return { error: "Import up to 2,000 rows at a time." };

  const seen = new Map<string, number>();
  const rowErrors: { row: number; sku: string; errors: string[] }[] = [];
  const valid: Record<string, string>[] = [];
  rows.slice(1).forEach((r, i) => {
    const obj = Object.fromEntries(CSV_COLUMNS.map((c) => [c, (r[header.indexOf(c)] ?? "").trim()]));
    const errors: string[] = [];
    const p = csvRow.safeParse(obj);
    if (!p.success) errors.push(...p.error.issues.map((x) => x.message));
    const sku = obj.sku.toUpperCase();
    if (sku && seen.has(sku)) errors.push(`duplicate SKU in file (also row ${seen.get(sku)})`);
    else if (sku) seen.set(sku, i + 2);
    if (errors.length) rowErrors.push({ row: i + 2, sku: obj.sku, errors });
    else valid.push(obj);
  });

  const supabase = await createClient();
  const [{ data: cats }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("slug"),
    supabase.from("products").select("sku").in("sku", [...seen.keys()]),
  ]);
  const catSet = new Set((cats ?? []).map((c) => c.slug));
  const existingSet = new Set((existing ?? []).map((p) => p.sku));
  valid.forEach((v, i) => {
    const errs: string[] = [];
    if (!catSet.has(v.category_slug)) errs.push(`unknown category_slug "${v.category_slug}"`);
    if (mode === "create_only" && existingSet.has(v.sku.toUpperCase())) errs.push("SKU already exists (choose 'Create or update' to overwrite)");
    if (errs.length) rowErrors.push({ row: seen.get(v.sku.toUpperCase()) ?? i + 2, sku: v.sku, errors: errs });
  });

  if (rowErrors.length) {
    rowErrors.sort((a, b) => a.row - b.row);
    return { error: `${rowErrors.length} row(s) have problems. Nothing was imported — fix them and upload again.${unknown.length ? ` Ignored columns: ${unknown.join(", ")}.` : ""}`, rowErrors };
  }
  const { data, error } = await supabase.rpc("import_products", { p_rows: valid, p_mode: mode });
  if (error) return { error: `Import aborted, nothing was saved: ${friendlyError(error)}` };
  revalidatePath("/admin/products");
  revalidatePath("/catalog", "layout");
  const summary = data as { created: number; updated: number };
  return { ok: true, message: `Imported: ${summary.created} created, ${summary.updated} updated`, summary };
}
