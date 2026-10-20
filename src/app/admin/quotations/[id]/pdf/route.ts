import { getSession } from "@/lib/auth";
import { renderQuotationPdf } from "@/lib/pdf/quotation";
import { createClient } from "@/lib/supabase/server";

// Shared by staff and customers: RLS on quotations decides visibility (customers never see drafts).
export async function GET(_req: Request, ctx: RouteContext<"/admin/quotations/[id]/pdf">) {
  const session = await getSession();
  if (!session) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const pdf = await renderQuotationPdf(supabase, id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
