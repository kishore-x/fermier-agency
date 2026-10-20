import { renderDatasheet } from "@/lib/pdf/datasheet";
import { createClient } from "@/lib/supabase/server";

// Public, branded product data sheet (only active products are visible through catalog_products).
export async function GET(req: Request, ctx: RouteContext<"/products/[slug]/datasheet">) {
  const { slug } = await ctx.params;
  const pdf = await renderDatasheet(await createClient(), slug);
  if (!pdf) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.has("view");
  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdf.filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
