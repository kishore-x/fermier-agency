"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify, str } from "@/lib/utils";

const catSchema = z.object({
  name: z.string().min(2, "Name required").max(100),
  slug: z.string().max(100).regex(/^$|^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens"),
  description: z.string().max(500),
  parent_id: z.string(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

export async function saveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const p = catSchema.safeParse({ name: str(fd.get("name")), slug: str(fd.get("slug")), description: str(fd.get("description")),
    parent_id: str(fd.get("parent_id")), sort_order: str(fd.get("sort_order")) || "0" });
  if (!p.success) return { error: p.error.issues[0].message };
  const id = str(fd.get("id"));
  if (id && p.data.parent_id === id) return { error: "A category cannot be its own parent." };
  const row = { ...p.data, slug: p.data.slug || slugify(p.data.name), parent_id: p.data.parent_id || null, description: p.data.description || null };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("categories").update(row).eq("id", id) : await supabase.from("categories").insert(row);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Category updated" : "Category added" };
}

export async function toggleCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: str(fd.get("active")) === "true" }).eq("id", str(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true, message: "Category updated" };
}

export async function moveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const supabase = await createClient();
  const { data: all } = await supabase.from("categories").select("id, sort_order").is("parent_id", null).order("sort_order").order("name");
  const list = all ?? [];
  const i = list.findIndex((c) => c.id === str(fd.get("id")));
  const j = i + (str(fd.get("dir")) === "up" ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  for (const [idx, c] of list.entries()) {
    if (c.sort_order !== idx + 1) await supabase.from("categories").update({ sort_order: idx + 1 }).eq("id", c.id);
  }
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBrand(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const name = str(fd.get("name"));
  if (name.length < 2 || name.length > 80) return { error: "Brand name must be 2–80 characters." };
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const row = { name, slug: slugify(name) };
  const { error } = id ? await supabase.from("brands").update(row).eq("id", id) : await supabase.from("brands").insert(row);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/brands");
  return { ok: true, message: id ? "Brand updated" : "Brand added" };
}

export async function toggleBrand(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("brands").update({ is_active: str(fd.get("active")) === "true" }).eq("id", str(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/brands");
  return { ok: true, message: "Brand updated" };
}
