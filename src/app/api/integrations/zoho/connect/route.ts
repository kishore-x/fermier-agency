import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { can, getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { ZOHO_SCOPES, zohoCredentialsPresent, zohoUrls } from "@/lib/zoho/client";

export async function GET() {
  const session = await getSession();
  if (!session || !can.manageIntegrations(session)) return new Response("Forbidden", { status: 403 });
  if (!zohoCredentialsPresent()) return NextResponse.redirect(new URL("/admin/integrations?error=credentials", env.siteUrl()));
  const { data: conn } = await createAdminClient().from("integration_connections").select("region").eq("provider", "zoho_books").single();
  const state = randomBytes(24).toString("hex");
  (await cookies()).set("zoho_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  const url = new URL(`${zohoUrls(conn?.region ?? "in").accounts}/oauth/v2/auth`);
  url.search = new URLSearchParams({
    scope: ZOHO_SCOPES, client_id: process.env.ZOHO_CLIENT_ID!, response_type: "code", access_type: "offline", prompt: "consent",
    redirect_uri: `${env.siteUrl()}/api/integrations/zoho/callback`, state,
  }).toString();
  return NextResponse.redirect(url);
}
