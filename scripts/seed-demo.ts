/**
 * Creates demo logins (one per role) and sample transactions on a real Supabase project by calling the
 * same RPCs the app uses. Run after `supabase db push --include-seed`:
 *   DEMO_PASSWORD='...' npm run seed:demo
 */
import { createClient } from "@supabase/supabase-js";
import { runDemoSeed } from "../src/lib/demo-seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = process.env.DEMO_PASSWORD;
if (!url || !anon || !service) throw new Error("Set Supabase env vars (see .env.example)");
if (!PASSWORD || PASSWORD.length < 8) throw new Error("Set DEMO_PASSWORD (min 8 chars) — used for every demo login");

const admin = createClient(url, service, { auth: { persistSession: false } });
async function signIn(email: string) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD! });
  if (error) throw error;
  return c;
}

runDemoSeed(admin, signIn, PASSWORD).catch((e) => { console.error(e); process.exit(1); });
