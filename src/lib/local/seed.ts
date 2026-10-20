import "server-only";
import { runDemoSeed } from "@/lib/demo-seed";
import { createLocalClient } from "./client";

export const LOCAL_DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";

/** Runs once, when the local database is first created. */
export async function seedLocalDemo() {
  const admin = createLocalClient({ service: true, skipReady: true });
  const signIn = async (email: string) => {
    const c = createLocalClient({ userId: null, skipReady: true });
    const { error } = await c.auth.signInWithPassword({ email, password: LOCAL_DEMO_PASSWORD });
    if (error) throw new Error(error.message);
    return c;
  };
  await runDemoSeed(admin, signIn, LOCAL_DEMO_PASSWORD, (m) => console.log(`[local-db] ${m}`));
}
