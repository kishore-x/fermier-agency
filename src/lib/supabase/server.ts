import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { createLocalClient } from "@/lib/local/client";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (env.isLocal()) {
    return createLocalClient({
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v) => { try { cookieStore.set(n, v, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 }); } catch { /* read-only in RSC */ } },
        remove: (n) => { try { cookieStore.delete(n); } catch { /* read-only in RSC */ } },
      },
    }) as unknown as SupabaseClient;
  }
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS — only for trusted server code (integration jobs, signup provisioning). */
export function createAdminClient(): SupabaseClient {
  if (env.isLocal()) return createLocalClient({ service: true }) as unknown as SupabaseClient;
  return createSbClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
