import { getSession } from "@/lib/auth";
import { renderQuotationPdf } from "@/lib/pdf/quotation";
import { createClient } from "@/lib/supabase/server";

// RLS ensures customers only see their own non-draft quotations.
export async function GET(_req: Request, ctx: RouteContext<"/portal/quotations/[id]/pdf">) {
  const session = await getSession();
  if (!session?.customerId) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const pdf = await renderQuotationPdf(await createClient(), id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
