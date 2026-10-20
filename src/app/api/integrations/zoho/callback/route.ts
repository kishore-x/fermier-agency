import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { can, getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { zohoUrls } from "@/lib/zoho/client";

export async function GET(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/integrations?${q}`, env.siteUrl()));
  const session = await getSession();
  if (!session || !can.manageIntegrations(session)) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("zoho_oauth_state")?.value;
  jar.delete("zoho_oauth_state");
  if (!expected || url.searchParams.get("state") !== expected) return back("error=state");
  const code = url.searchParams.get("code");
  if (!code) return back(`error=${encodeURIComponent(url.searchParams.get("error") ?? "denied")}`);

  const admin = createAdminClient();
  const { data: conn } = await admin.from("integration_connections").select("region").eq("provider", "zoho_books").single();
  // Zoho may report the account's data centre; prefer it when present.
  const accountsServer = url.searchParams.get("accounts-server") ?? zohoUrls(conn?.region ?? "in").accounts;
  if (!/^https:\/\/accounts\.zoho\.[a-z.]+$/.test(accountsServer)) return back("error=accounts_server");
  const res = await fetch(`${accountsServer}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: process.env.ZOHO_CLIENT_ID!, client_secret: process.env.ZOHO_CLIENT_SECRET!,
      redirect_uri: `${env.siteUrl()}/api/integrations/zoho/callback`, code,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!json.refresh_token) return back(`error=${encodeURIComponent(json.error ?? "no_refresh_token")}`);
  await admin.from("integration_secrets").upsert({ provider: "zoho_books", refresh_token: json.refresh_token, access_token: json.access_token ?? null, updated_at: new Date().toISOString() });
  await admin.from("integration_connections").update({
    is_connected: true, token_expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(), updated_by: session.userId, updated_at: new Date().toISOString(),
  }).eq("provider", "zoho_books");
  await admin.from("audit_logs").insert({ actor_id: session.userId, action: "integration.zoho_connected", entity_type: "integration", entity_id: "zoho_books" });
  return back("connected=1");
}
