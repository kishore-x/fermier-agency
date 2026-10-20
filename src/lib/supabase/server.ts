import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
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
export function createAdminClient() {
  return createSbClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
