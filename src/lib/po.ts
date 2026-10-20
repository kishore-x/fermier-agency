import "server-only";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

// Authorization is enforced by storage policies and register_customer_po() (staff, or the owning customer).
const PO_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function registerPo(fd: FormData): Promise<ActionState> {
  const quotationId = str(fd.get("quotation_id"));
  const poNumber = str(fd.get("po_number"));
  const poDate = str(fd.get("po_date"));
  const amount = str(fd.get("po_amount"));
  const file = fd.get("file");
  if (!poNumber || poNumber.length > 60) return { error: "Enter the PO number." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(poDate)) return { error: "Enter the PO date." };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount)) return { error: "Enter the PO amount (numbers only)." };
  if (!(file instanceof File) || !file.size) return { error: "Attach the PO document." };
  if (!PO_TYPES.includes(file.type)) return { error: "PO must be a PDF, JPG, PNG or WebP." };
  if (file.size > 10 * 1024 * 1024) return { error: "PO file must be under 10 MB." };
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotations").select("id, customer_id, status").eq("id", quotationId).maybeSingle();
  if (!q) return { error: "Quotation not found" };
  if (q.status !== "accepted") return { error: "A PO can only be attached to an accepted quotation." };
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${q.customer_id}/purchase-orders/${crypto.randomUUID()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from("customer-documents").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };
  const { error } = await supabase.rpc("register_customer_po", {
    p_quotation: quotationId, p_po_number: poNumber, p_po_date: poDate, p_amount: Number(amount),
    p_storage_path: path, p_file_name: file.name.slice(0, 200), p_notes: str(fd.get("notes")).slice(0, 1000) || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/quotations/${quotationId}`);
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/portal", "layout");
  return { ok: true, message: `PO ${poNumber} uploaded` };
}
