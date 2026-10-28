import { readFileSync, existsSync } from "node:fs";
import { env } from "@/lib/env";
import { filePath, verifyFileSig } from "@/lib/local/client";
import { withContext } from "@/lib/local/db";

// Serves files stored by the local demo backend: public buckets directly, private ones via signed URLs.
export async function GET(req: Request, ctx: RouteContext<"/api/local-files/[...path]">) {
  if (!env.isLocal()) return new Response("Not found", { status: 404 });
  const parts = (await ctx.params).path.map(decodeURIComponent);
  const isPublic = parts[0] === "public";
  const [bucket, ...rest] = isPublic ? parts.slice(1) : parts;
  const name = rest.join("/");
  if (!bucket || !name) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const row = await withContext({ userId: null, service: true }, (tx) =>
    tx.query<{ mimetype: string; public: boolean; data: Uint8Array | null }>("select o.mimetype, b.public, o.data from storage.objects o join storage.buckets b on b.id = o.bucket_id where o.bucket_id = $1 and o.name = $2", [bucket, name]));
  const obj = row.rows[0];
  if (!obj) return new Response("Not found", { status: 404 });
  if (isPublic ? !obj.public : !verifyFileSig(bucket, name, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new Response("Forbidden", { status: 403 });
  }
  // Files are stored in the database; older local databases kept them on disk.
  let body = obj.data;
  if (!body) {
    const f = filePath(bucket, name);
    if (!existsSync(f)) return new Response("Not found", { status: 404 });
    body = new Uint8Array(readFileSync(f));
  }
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": obj.mimetype || "application/octet-stream", "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
