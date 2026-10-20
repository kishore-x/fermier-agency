import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ZohoClient, ZohoError, zohoCredentialsPresent } from "./client";

type Conn = { mode: "mock" | "live"; organization_id: string | null; region: string; is_connected: boolean; settings: { tax_map?: Record<string, string> } };
type Result = { ok: boolean; message: string };

const MAX_ATTEMPTS = 6;
const backoffMs = (attempt: number) => Math.min(60 * 60_000, 60_000 * 2 ** (attempt - 1));

async function log(admin: SupabaseClient, jobId: string | null, level: "info" | "error", message: string, req?: unknown, resp?: unknown) {
  await admin.from("integration_logs").insert({ provider: "zoho_books", job_id: jobId, level, message: message.slice(0, 1000), request_summary: req ?? null, response_summary: resp ?? null });
}

export async function getConnection(admin = createAdminClient()): Promise<Conn> {
  const { data } = await admin.from("integration_connections").select("mode, organization_id, region, is_connected, settings").eq("provider", "zoho_books").single();
  return (data ?? { mode: "mock", organization_id: null, region: "in", is_connected: false, settings: {} }) as Conn;
}

/**
 * Queue invoice creation for a sales order. Idempotent: one job per order (unique idempotency_key)
 * and one invoice row per order (unique sales_order_id + provider).
 */
export async function enqueueInvoice(orderId: string, opts: { processNow?: boolean } = {}): Promise<Result> {
  const session = await getSession();
  if (!session?.isStaff) return { ok: false, message: "Forbidden" };
  const admin = createAdminClient();
  const { data: so } = await admin.from("sales_orders").select("id, customer_id, status, grand_total").eq("id", orderId).single();
  if (!so) return { ok: false, message: "Order not found" };
  if (["cancelled", "pending_confirmation"].includes(so.status)) return { ok: false, message: `Cannot invoice an order in status ${so.status}` };
  await admin.from("invoices").upsert({ sales_order_id: so.id, customer_id: so.customer_id, provider: "zoho_books", sync_status: "pending" },
    { onConflict: "sales_order_id,provider", ignoreDuplicates: true });
  const { data: job } = await admin.from("integration_jobs").upsert({
    provider: "zoho_books", job_type: "create_invoice", entity_type: "sales_order", entity_id: so.id, idempotency_key: `zoho:invoice:${so.id}`, created_by: session.userId,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  await admin.from("audit_logs").insert({ actor_id: session.userId, action: "invoice.create_requested", entity_type: "sales_order", entity_id: so.id });
  if (!opts.processNow) return { ok: true, message: "Invoice creation queued" };
  const jobId = job?.id ?? (await admin.from("integration_jobs").select("id").eq("idempotency_key", `zoho:invoice:${so.id}`).single()).data!.id;
  return processJob(jobId, { force: true });
}

export async function retryJob(jobId: string): Promise<Result> {
  const admin = createAdminClient();
  await admin.from("integration_jobs").update({ status: "pending", next_attempt_at: new Date().toISOString() }).eq("id", jobId).in("status", ["failed", "pending"]);
  return processJob(jobId, { force: true });
}

/** Process due jobs (cron). */
export async function processDueJobs(limit = 10) {
  const admin = createAdminClient();
  const { data: jobs } = await admin.from("integration_jobs").select("id").in("status", ["pending"]).lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(limit);
  const results = [];
  for (const j of jobs ?? []) results.push(await processJob(j.id, { force: false }));
  return results;
}

async function processJob(jobId: string, { force }: { force: boolean }): Promise<Result> {
  const admin = createAdminClient();
  // Claim atomically so concurrent runners don't double-process.
  const { data: job } = await admin.from("integration_jobs").update({ status: "processing" }).eq("id", jobId)
    .in("status", force ? ["pending", "failed"] : ["pending"]).select("*").maybeSingle();
  if (!job) {
    const { data: cur } = await admin.from("integration_jobs").select("status").eq("id", jobId).single();
    return { ok: cur?.status === "succeeded", message: cur?.status === "succeeded" ? "Invoice already created" : `Job is ${cur?.status ?? "missing"}` };
  }
  const attempts = job.attempts + 1;
  try {
    const conn = await getConnection(admin);
    const message = job.job_type === "sync_invoice" ? await syncInvoice(admin, conn, job.entity_id) : await createInvoice(admin, conn, job.entity_id, job.id);
    await admin.from("integration_jobs").update({ status: "succeeded", attempts, last_error: null }).eq("id", jobId);
    return { ok: true, message };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const retryable = e instanceof ZohoError ? e.retryable : false;
    const giveUp = !retryable || attempts >= MAX_ATTEMPTS;
    await admin.from("integration_jobs").update({
      status: giveUp ? "failed" : "pending", attempts, last_error: err.slice(0, 1000),
      next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
    }).eq("id", jobId);
    await admin.from("invoices").update({ sync_status: "failed" }).eq("sales_order_id", job.entity_id).eq("provider", "zoho_books").neq("sync_status", "created");
    await log(admin, jobId, "error", err);
    if (giveUp) {
      const { data: users } = await admin.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
      await admin.from("notifications").insert((users ?? []).map((u) => ({ user_id: u.user_id, event_type: "integration.failure", title: `Zoho Books: ${err.slice(0, 120)}`, link: "/admin/integrations" })));
    }
    return { ok: false, message: `Zoho Books: ${err}${giveUp ? "" : " — will retry automatically"}` };
  }
}

type OrderBundle = {
  so: { id: string; order_number: string; order_date: string; customer_id: string; payment_terms: string | null; shipping_charges: string; other_charges: string; grand_total: string; customer_po_id: string | null };
  items: { product_id: string | null; sku_snapshot: string; name_snapshot: string; description_snapshot: string | null; quantity: string; unit_price: string; discount_pct: string; tax_rate: string }[];
  customer: { id: string; company_name: string; email: string | null; phone: string | null; gstin: string | null; billing_address: string | null; state: string | null };
};

async function loadOrder(admin: SupabaseClient, orderId: string): Promise<OrderBundle> {
  const { data: so } = await admin.from("sales_orders").select("id, order_number, order_date, customer_id, payment_terms, shipping_charges, other_charges, grand_total, customer_po_id, status").eq("id", orderId).single();
  if (!so) throw new Error("Sales order not found");
  if (so.status === "cancelled") throw new Error("Order was cancelled");
  const [{ data: items }, { data: customer }] = await Promise.all([
    admin.from("sales_order_items").select("product_id, sku_snapshot, name_snapshot, description_snapshot, quantity, unit_price, discount_pct, tax_rate").eq("sales_order_id", orderId).order("sort_order"),
    admin.from("customers").select("id, company_name, email, phone, gstin, billing_address, state").eq("id", so.customer_id).single(),
  ]);
  return { so, items: items ?? [], customer: customer! };
}

async function mapping(admin: SupabaseClient, entity: string, internalId: string) {
  const { data } = await admin.from("external_record_mappings").select("external_id, is_mock").eq("provider", "zoho_books").eq("entity_type", entity).eq("internal_id", internalId).maybeSingle();
  return data;
}
async function saveMapping(admin: SupabaseClient, entity: string, internalId: string, externalId: string, isMock: boolean) {
  await admin.from("external_record_mappings").upsert({ provider: "zoho_books", entity_type: entity, internal_id: internalId, external_id: externalId, is_mock: isMock }, { onConflict: "provider,entity_type,internal_id" });
}

async function createInvoice(admin: SupabaseClient, conn: Conn, orderId: string, jobId: string): Promise<string> {
  const { so, items, customer } = await loadOrder(admin, orderId);
  const existing = await mapping(admin, "invoice", so.id);

  if (conn.mode === "mock") {
    if (existing) return "Simulated invoice already exists";
    const mockNo = `SIM-${so.order_number}`;
    const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    await admin.from("invoices").update({
      is_mock: true, external_invoice_id: null, external_invoice_number: mockNo, external_url: null, invoice_date: new Date().toISOString().slice(0, 10),
      due_date: due, total: so.grand_total, balance_due: so.grand_total, external_status: "simulated", sync_status: "mock", last_synced_at: new Date().toISOString(),
    }).eq("sales_order_id", so.id).eq("provider", "zoho_books");
    await saveMapping(admin, "invoice", so.id, mockNo, true);
    await log(admin, jobId, "info", `Mock mode: simulated invoice ${mockNo} for ${so.order_number}. Nothing was sent to Zoho Books.`);
    await notifyInvoice(admin, customer.id, so.id, `${mockNo} (simulated)`);
    return `Simulated invoice ${mockNo} recorded (mock mode — not sent to Zoho Books)`;
  }

  if (!zohoCredentialsPresent() || !conn.organization_id || !conn.is_connected) throw new ZohoError("Zoho Books live mode is not fully configured (client credentials, organisation ID and authorisation are required).", 400);
  const zoho = new ZohoClient(admin, conn.region, conn.organization_id);

  if (existing && !existing.is_mock) {
    await syncInvoice(admin, conn, so.id);
    return "Invoice already exists in Zoho Books — status synchronised";
  }

  // 1. Contact: mapping → match by email/name → create.
  let contactId = (await mapping(admin, "customer", customer.id))?.external_id;
  if (!contactId) {
    const q: Record<string, string> = customer.email ? { email: customer.email } : { contact_name: customer.company_name };
    const found = await zoho.request<{ contacts: { contact_id: string; contact_name: string }[] }>("GET", "/contacts", { query: { ...q, contact_type: "customer" } });
    contactId = found.contacts.find((c) => customer.email || c.contact_name.toLowerCase() === customer.company_name.toLowerCase())?.contact_id;
    if (!contactId) {
      const created = await zoho.request<{ contact: { contact_id: string } }>("POST", "/contacts", { body: {
        contact_name: customer.company_name, company_name: customer.company_name, contact_type: "customer",
        ...(customer.gstin ? { gst_no: customer.gstin, gst_treatment: "business_gst" } : {}),
        billing_address: customer.billing_address ? { address: customer.billing_address, state: customer.state ?? undefined } : undefined,
        contact_persons: customer.email ? [{ email: customer.email, phone: customer.phone ?? undefined, is_primary_contact: true }] : undefined,
      } });
      contactId = created.contact.contact_id;
      await log(admin, jobId, "info", `Created Zoho contact for ${customer.company_name}`, { customer_id: customer.id }, { contact_id: contactId });
    }
    await saveMapping(admin, "customer", customer.id, contactId, false);
  }

  // 2. Items: must be mapped explicitly — internal SKU is never assumed to equal a Zoho item.
  const lineItems = [];
  const unmapped: string[] = [];
  const taxMap = conn.settings.tax_map ?? {};
  for (const it of items) {
    const m = it.product_id ? await mapping(admin, "product", it.product_id) : null;
    if (!m) { unmapped.push(it.sku_snapshot); continue; }
    const taxId = taxMap[String(Number(it.tax_rate))];
    if (!taxId) throw new ZohoError(`No Zoho tax mapping for GST ${Number(it.tax_rate)}%. Add it under Integrations → Tax mapping.`, 400);
    lineItems.push({ item_id: m.external_id, name: it.name_snapshot, description: it.description_snapshot ?? undefined, quantity: Number(it.quantity), rate: Number(it.unit_price), discount: `${Number(it.discount_pct)}%`, tax_id: taxId });
  }
  if (unmapped.length) throw new ZohoError(`Map these products to Zoho items first: ${unmapped.join(", ")}`, 400);

  // 3. Duplicate guard: look for an invoice already carrying our order number before creating.
  const search = await zoho.request<{ invoices: { invoice_id: string; reference_number: string }[] }>("GET", "/invoices", { query: { reference_number: so.order_number } });
  let invoiceId = search.invoices.find((i) => i.reference_number === so.order_number)?.invoice_id;
  if (!invoiceId) {
    const { data: po } = so.customer_po_id ? await admin.from("customer_purchase_orders").select("po_number").eq("id", so.customer_po_id).single() : { data: null };
    const created = await zoho.request<{ invoice: { invoice_id: string } }>("POST", "/invoices", { body: {
      customer_id: contactId, reference_number: so.order_number, date: new Date().toISOString().slice(0, 10),
      line_items: lineItems, shipping_charge: Number(so.shipping_charges), adjustment: Number(so.other_charges) || undefined,
      adjustment_description: Number(so.other_charges) ? "Other charges" : undefined,
      notes: po ? `Customer PO: ${po.po_number}` : undefined, payment_terms_label: so.payment_terms ?? undefined,
    } });
    invoiceId = created.invoice.invoice_id;
    await log(admin, jobId, "info", `Created Zoho invoice for ${so.order_number}`, { order: so.order_number, lines: lineItems.length }, { invoice_id: invoiceId });
  } else {
    await log(admin, jobId, "info", `Found existing Zoho invoice for ${so.order_number}; linking instead of creating a duplicate`, null, { invoice_id: invoiceId });
  }
  await saveMapping(admin, "invoice", so.id, invoiceId, false);
  await syncInvoice(admin, conn, so.id);
  const { data: inv } = await admin.from("invoices").select("external_invoice_number").eq("sales_order_id", so.id).single();
  await notifyInvoice(admin, customer.id, so.id, inv?.external_invoice_number ?? "");
  return `Zoho Books invoice ${inv?.external_invoice_number ?? invoiceId} linked to ${so.order_number}`;
}

export async function syncInvoice(admin: SupabaseClient, conn: Conn, orderId: string): Promise<string> {
  const m = await mapping(admin, "invoice", orderId);
  if (!m) throw new Error("No invoice to synchronise");
  if (m.is_mock || conn.mode === "mock") return "Simulated invoice — nothing to synchronise";
  const zoho = new ZohoClient(admin, conn.region, conn.organization_id!);
  const { invoice } = await zoho.request<{ invoice: { invoice_id: string; invoice_number: string; invoice_url?: string; status: string; total: number; balance: number; date: string; due_date: string } }>("GET", `/invoices/${m.external_id}`);
  await admin.from("invoices").update({
    is_mock: false, external_invoice_id: invoice.invoice_id, external_invoice_number: invoice.invoice_number, external_url: invoice.invoice_url ?? null,
    external_status: invoice.status, total: invoice.total, balance_due: invoice.balance, invoice_date: invoice.date, due_date: invoice.due_date,
    sync_status: "created", last_synced_at: new Date().toISOString(),
  }).eq("sales_order_id", orderId).eq("provider", "zoho_books");
  return `Synchronised: ${invoice.invoice_number} is ${invoice.status}`;
}

async function notifyInvoice(admin: SupabaseClient, customerId: string, orderId: string, number: string) {
  const { data: users } = await admin.from("customer_users").select("user_id").eq("customer_id", customerId);
  if (users?.length) await admin.from("notifications").insert(users.map((u) => ({ user_id: u.user_id, event_type: "invoice.created", title: `Invoice ${number} issued`, link: `/portal/orders/${orderId}` })));
}

/** Refresh payment status for all live invoices with an outstanding balance. */
export async function syncOpenInvoices(limit = 25) {
  const admin = createAdminClient();
  const conn = await getConnection(admin);
  if (conn.mode !== "live" || !conn.is_connected) return { synced: 0, skipped: "not live" };
  const { data } = await admin.from("invoices").select("sales_order_id").eq("sync_status", "created").or("balance_due.is.null,balance_due.gt.0").order("last_synced_at", { ascending: true, nullsFirst: true }).limit(limit);
  let synced = 0;
  for (const r of data ?? []) {
    try { await syncInvoice(admin, conn, r.sales_order_id); synced++; } catch (e) { await log(admin, null, "error", `Sync failed: ${e instanceof Error ? e.message : e}`); }
  }
  return { synced };
}
