import Link from "next/link";
import { CheckCircle2, CircleDashed, Mail, PlugZap } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Alert, Card, CardHeader, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ZOHO_REGIONS, zohoCredentialsPresent } from "@/lib/zoho/client";
import { formatDateTime, humanize } from "@/lib/utils";
import { disconnectZoho, mapProduct, retryIntegrationJob, saveZohoSettings, testZoho } from "./actions";

const ERRORS: Record<string, string> = {
  credentials: "ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are not set on the server.",
  state: "Authorisation could not be verified (state mismatch). Please try again.",
  accounts_server: "Unexpected Zoho accounts server in the callback.",
};

export default async function IntegrationsPage({ searchParams }: PageProps<"/admin/integrations">) {
  await requireStaff("admin");
  const sp = (await searchParams) as { error?: string; connected?: string; tab?: string };
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: conn }, { data: jobs }, { data: logs }, { data: products }, { data: maps }, { data: rates }] = await Promise.all([
    supabase.from("integration_connections").select("*").eq("provider", "zoho_books").single(),
    supabase.from("integration_jobs").select("id, job_type, entity_id, status, attempts, last_error, next_attempt_at, updated_at").order("updated_at", { ascending: false }).limit(25),
    supabase.from("integration_logs").select("id, level, message, created_at").order("created_at", { ascending: false }).limit(25),
    supabase.from("products").select("id, sku, name").neq("status", "archived").order("name"),
    admin.from("external_record_mappings").select("internal_id, external_id, entity_type, is_mock").eq("provider", "zoho_books").eq("entity_type", "product"),
    supabase.from("products").select("tax_rate"),
  ]);
  const { data: orders } = await supabase.from("sales_orders").select("id, order_number").in("id", (jobs ?? []).map((j) => j.entity_id));
  const orderNo = new Map((orders ?? []).map((o) => [o.id, o.order_number]));
  const mapOf = new Map((maps ?? []).map((m) => [m.internal_id, m.external_id]));
  const taxRates = [...new Set((rates ?? []).map((r) => String(Number(r.tax_rate))))].sort((a, b) => Number(a) - Number(b));
  const taxMap = (conn?.settings as { tax_map?: Record<string, string> })?.tax_map ?? {};
  const live = conn?.mode === "live";
  const creds = zohoCredentialsPresent();
  const tab = sp.tab ?? "zoho";

  return (
    <>
      <PageHeader title="Integrations" description="Zoho Books is the accounting source of truth. This system sends confirmed orders for invoicing and reads back payment status." />
      {sp.error && <Alert tone="error" className="mb-4">{ERRORS[sp.error] ?? `Zoho authorisation failed: ${sp.error}`}</Alert>}
      {sp.connected && <Alert tone="success" className="mb-4">Zoho Books authorised. Run a connection test, then switch to live mode.</Alert>}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <StatusCard title="Zoho Books" ok={live && conn?.is_connected} label={live ? (conn?.is_connected ? "Live — connected" : "Live — not authorised") : "Mock mode (simulated invoices)"} icon={<PlugZap className="h-5 w-5" />} />
        <StatusCard title="Email (Resend)" ok={emailConfigured()} label={emailConfigured() ? "Configured" : "Not configured — emails disabled"} icon={<Mail className="h-5 w-5" />} />
        <StatusCard title="WhatsApp" ok label="Click-to-chat links only (no API)" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="mb-4 flex gap-1 border-b border-line">
        {[["zoho", "Connection"], ["mapping", "Product & tax mapping"], ["jobs", "Jobs & logs"]].map(([k, l]) => (
          <Link key={k} href={`?tab=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-navy font-medium text-navy" : "border-transparent text-muted"}`}>{l}</Link>
        ))}
      </div>

      {tab === "zoho" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Zoho Books connection" />
            <div className="space-y-4 p-4 text-sm">
              {!live && <Alert tone="info">Mock mode: invoices are <strong>simulated</strong> locally, numbered <code>SIM-…</code> and labelled “Simulated” everywhere. Nothing is sent to Zoho Books.</Alert>}
              {!creds && <Alert tone="warn">Server credentials missing. Set <code>ZOHO_CLIENT_ID</code> and <code>ZOHO_CLIENT_SECRET</code> (from api-console.zoho.in, “Server-based application”) and redeploy.</Alert>}
              <ActionForm action={saveZohoSettings} className="space-y-3">
                <Field label="Mode" name="mode">
                  <Select id="mode" name="mode" defaultValue={conn?.mode ?? "mock"}><option value="mock">Mock — simulate invoices (demo)</option><option value="live">Live — create real invoices in Zoho Books</option></Select>
                </Field>
                <Field label="Data centre" name="region" hint="Must match where your Zoho account is hosted (India = .in)">
                  <Select id="region" name="region" defaultValue={conn?.region ?? "in"}>{ZOHO_REGIONS.map((r) => <option key={r} value={r}>zoho.{r}</option>)}</Select>
                </Field>
                <Field label="Organisation ID" name="organization_id" hint="Zoho Books → Settings → Organisation Profile"><Input id="organization_id" name="organization_id" defaultValue={conn?.organization_id ?? ""} inputMode="numeric" /></Field>
                {Object.entries(taxMap).map(([k, v]) => <input key={k} type="hidden" name={`tax_${k}`} value={v} />)}
                <SubmitButton>Save settings</SubmitButton>
              </ActionForm>
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {creds && <LinkButton href="/api/integrations/zoho/connect" prefetch={false} variant={conn?.is_connected ? "outline" : "success"}>{conn?.is_connected ? "Re-authorise" : "Authorise Zoho Books"}</LinkButton>}
                {conn?.is_connected && <ConfirmAction action={async () => { "use server"; return testZoho(); }} trigger="Test connection" title="Test Zoho connection?" confirmLabel="Run test" />}
                {conn?.is_connected && <ConfirmAction action={async () => { "use server"; return disconnectZoho(); }} trigger="Disconnect" tone="danger" title="Disconnect Zoho Books?" description="Removes stored tokens and switches to mock mode. Existing invoice links are kept." confirmLabel="Disconnect" />}
              </div>
              <p className="text-xs text-muted">Token expires: {formatDateTime(conn?.token_expires_at)} (refreshed automatically). Redirect URI to register: <code>{`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4480"}/api/integrations/zoho/callback`}</code></p>
            </div>
          </Card>
          <Card>
            <CardHeader title="How invoicing works" />
            <ol className="list-decimal space-y-2 p-4 pl-8 text-sm text-muted">
              <li>An invoice job is queued when an order is confirmed or dispatched (Settings → invoicing stage), or manually from the order.</li>
              <li>The customer is matched to a Zoho contact (saved mapping → email → name) or created once.</li>
              <li>Every product must be mapped to a Zoho item — SKUs are never assumed to match.</li>
              <li>Before creating, Zoho is searched for an invoice with the order number as reference, so retries never create duplicates.</li>
              <li>Invoice number, URL, status and balance are stored and refreshed by the scheduled sync.</li>
              <li>Failures are logged, retried with back-off, and can be retried manually here.</li>
            </ol>
          </Card>
        </div>
      )}

      {tab === "mapping" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader title="Product → Zoho item mapping" description={`${mapOf.size} of ${products?.length ?? 0} products mapped`} />
            <ul className="divide-y divide-line">
              {(products ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-56 flex-1">{p.name} <span className="font-mono text-xs text-muted">{p.sku}</span></span>
                  {mapOf.has(p.id) ? <StatusBadge status="active" label="Mapped" /> : <StatusBadge status="draft" label="Not mapped" />}
                  <ActionForm action={mapProduct} className="flex gap-2">
                    <input type="hidden" name="product_id" value={p.id} />
                    <Input name="external_id" defaultValue={mapOf.get(p.id) ?? ""} placeholder="Zoho item ID" aria-label={`Zoho item ID for ${p.sku}`} className="h-8 w-44" />
                    <SubmitButton size="sm" variant="outline">Save</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="h-fit">
            <CardHeader title="GST rate → Zoho tax ID" description="Required in live mode" />
            <ActionForm action={saveZohoSettings} className="space-y-2 p-4">
              <input type="hidden" name="mode" value={conn?.mode ?? "mock"} />
              <input type="hidden" name="region" value={conn?.region ?? "in"} />
              <input type="hidden" name="organization_id" value={conn?.organization_id ?? ""} />
              {taxRates.map((r) => (
                <Field key={r} label={`GST ${r}%`} name={`tax_${r}`}><Input id={`tax_${r}`} name={`tax_${r}`} defaultValue={taxMap[r] ?? ""} placeholder="Zoho tax ID" inputMode="numeric" /></Field>
              ))}
              <SubmitButton className="w-full">Save tax mapping</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "jobs" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Integration jobs" />
            <ul className="divide-y divide-line text-sm">
              {(jobs ?? []).map((j) => (
                <li key={j.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{humanize(j.job_type)}</span>
                    <Link href={`/admin/sales-orders/${j.entity_id}`} className="text-navy hover:underline">{orderNo.get(j.entity_id) ?? "order"}</Link>
                    <StatusBadge status={j.status} /><span className="text-xs text-muted">{j.attempts} attempt(s)</span>
                    {["failed", "pending"].includes(j.status) && (
                      <span className="ml-auto"><ConfirmAction action={retryIntegrationJob} fields={{ job_id: j.id }} trigger="Retry now" title="Retry this job?" confirmLabel="Retry" /></span>
                    )}
                  </div>
                  {j.last_error && <p className="text-xs text-danger">{j.last_error}</p>}
                  <p className="text-xs text-muted">Updated {formatDateTime(j.updated_at)}{j.status === "pending" && j.attempts > 0 ? ` · next attempt ${formatDateTime(j.next_attempt_at)}` : ""}</p>
                </li>
              ))}
              {!jobs?.length && <li className="px-4 py-6 text-center text-muted"><CircleDashed className="mx-auto mb-2 h-6 w-6" />No jobs yet.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Integration log" />
            <ul className="divide-y divide-line text-sm">
              {(logs ?? []).map((l) => (
                <li key={l.id} className="px-4 py-2"><p className={l.level === "error" ? "text-danger" : ""}>{l.message}</p><p className="text-xs text-muted">{formatDateTime(l.created_at)}</p></li>
              ))}
              {!logs?.length && <li className="px-4 py-6 text-center text-muted">No log entries.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function StatusCard({ title, ok, label, icon }: { title: string; ok?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={ok ? "text-brand" : "text-amber-600"}>{icon}</span>
      <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted">{label}</p></div>
    </Card>
  );
}
