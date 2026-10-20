import { timingSafeEqual } from "node:crypto";
import { processDueJobs, syncOpenInvoices } from "@/lib/zoho/jobs";

function authorised(req: Request) {
  const expected = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const jobs = await processDueJobs(20);
  const sync = await syncOpenInvoices(25);
  return Response.json({ processed: jobs.length, ok: jobs.filter((j) => j.ok).length, sync });
}
