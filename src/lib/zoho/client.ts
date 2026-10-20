import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ZOHO_REGIONS = ["in", "com", "eu", "com.au", "jp", "ca", "sa", "ae"] as const;
export type ZohoRegion = (typeof ZOHO_REGIONS)[number];

export const ZOHO_SCOPES = "ZohoBooks.invoices.ALL,ZohoBooks.contacts.ALL,ZohoBooks.settings.READ";

export const zohoUrls = (region: string) => ({
  api: `https://www.zohoapis.${region}/books/v3`,
  accounts: `https://accounts.zoho.${region}`,
});

export class ZohoError extends Error {
  constructor(message: string, public status: number, public code?: number, public retryable = false) {
    super(message);
  }
}

export function zohoCredentialsPresent() {
  return Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);
}

/** Live Zoho client. Uses the service-role client to read/write tokens (integration_secrets has no RLS policies). */
export class ZohoClient {
  constructor(private admin: SupabaseClient, private region: string, private orgId: string) {}

  private async accessToken(): Promise<string> {
    const { data: secret } = await this.admin.from("integration_secrets").select("access_token, refresh_token").eq("provider", "zoho_books").maybeSingle();
    const { data: conn } = await this.admin.from("integration_connections").select("token_expires_at").eq("provider", "zoho_books").single();
    if (!secret?.refresh_token) throw new ZohoError("Zoho Books is not connected. Authorise it under Integrations.", 401);
    const expires = conn?.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (secret.access_token && expires - Date.now() > 120_000) return secret.access_token;

    const body = new URLSearchParams({
      refresh_token: secret.refresh_token, client_id: process.env.ZOHO_CLIENT_ID!, client_secret: process.env.ZOHO_CLIENT_SECRET!, grant_type: "refresh_token",
    });
    const res = await fetch(`${zohoUrls(this.region).accounts}/oauth/v2/token`, { method: "POST", body, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !json.access_token) throw new ZohoError(`Token refresh failed: ${json.error ?? res.status}`, 401, undefined, res.status >= 500);
    await this.admin.from("integration_secrets").update({ access_token: json.access_token, updated_at: new Date().toISOString() }).eq("provider", "zoho_books");
    await this.admin.from("integration_connections").update({ token_expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString() }).eq("provider", "zoho_books");
    return json.access_token;
  }

  async request<T>(method: "GET" | "POST" | "PUT", path: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const url = new URL(`${zohoUrls(this.region).api}${path}`);
    url.searchParams.set("organization_id", this.orgId);
    Object.entries(opts.query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Zoho-oauthtoken ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string } & T;
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ZohoError(json.message ?? `Zoho HTTP ${res.status}`, res.status, json.code, retryable);
    }
    return json;
  }
}
