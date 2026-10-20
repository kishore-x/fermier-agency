"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

const schema = z.object({
  product_id: z.string().uuid(),
  movement_type: z.enum(["goods_received", "adjustment", "return", "correction"]),
  direction: z.enum(["in", "out"]),
  quantity: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a positive quantity").refine((v) => Number(v) > 0, "Quantity must be greater than zero"),
  reference: z.string().max(80),
  notes: z.string().max(500),
});

export async function recordMovement(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff("admin", "inventory_manager");
  const p = schema.safeParse({
    product_id: str(fd.get("product_id")), movement_type: str(fd.get("movement_type")), direction: str(fd.get("direction")) || "in",
    quantity: str(fd.get("quantity")), reference: str(fd.get("reference")), notes: str(fd.get("notes")),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  const inbound = v.movement_type === "goods_received" || v.movement_type === "return" || v.direction === "in";
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_product: v.product_id, p_type: v.movement_type, p_quantity: inbound ? Number(v.quantity) : -Number(v.quantity),
    p_notes: v.notes || null, p_reference: v.reference || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/inventory", "layout");
  return { ok: true, message: "Stock movement recorded" };
}
