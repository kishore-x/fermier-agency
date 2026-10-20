import "server-only";
import { headers } from "next/headers";

// Best-effort per-instance limiter for sensitive public endpoints (login, register, contact).
// On Vercel each instance has its own memory; swap for Upstash/Redis if abuse becomes real.
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(scope: string, limit: number, windowMs: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
