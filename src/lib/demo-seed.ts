// Shared by scripts/seed-demo.ts (real Supabase) and the local mock database.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export const USERS = [
  { email: "superadmin@fermier.demo", name: "Demo Super Admin", roles: ["super_admin"] },
  { email: "admin@fermier.demo", name: "Demo Admin", roles: ["admin"] },
  { email: "salesmanager@fermier.demo", name: "Demo Sales Manager", roles: ["sales_manager"], limit: 20 },
  { email: "sales@fermier.demo", name: "Demo Sales Executive", roles: ["sales_executive"], limit: 5 },
  { email: "inventory@fermier.demo", name: "Demo Inventory Manager", roles: ["inventory_manager"] },
  { email: "buyer@sample-builders.demo", name: "Demo Buyer (Sample Builders)", roles: ["customer"], customer: "CUS-DEMO-001" },
  { email: "buyer@demo-agro.demo", name: "Demo Buyer (Demo Agro)", roles: ["customer"], customer: "CUS-DEMO-002" },
] as const;

async function ensureUser(admin: Client, PASSWORD: string, u: (typeof USERS)[number]) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let id = list.users.find((x: { email: string }) => x.email === u.email)?.id;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.name } });
    if (error) throw error;
    id = data.user.id;
  }
  await admin.from("profiles").update({ full_name: u.name, discount_limit_pct: "limit" in u ? u.limit : 0 }).eq("id", id);
  for (const role of u.roles) await admin.from("user_roles").upsert({ user_id: id, role }, { ignoreDuplicates: true });
  if ("customer" in u) {
    const { data: c } = await admin.from("customers").select("id").eq("customer_code", u.customer).single();
    await admin.from("customer_users").upsert({ user_id: id, customer_id: c!.id });
  }
  return id;
}

async function rpc<T>(c: Client, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function runDemoSeed(admin: Client, signIn: (email: string) => Promise<Client>, PASSWORD: string, log: (m: string) => void = console.log) {
  const as = signIn;
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.email] = await ensureUser(admin, PASSWORD, u);
  log("✓ demo users ready");

  // Assign sample customers to the sales executive.
  await admin.from("customers").update({ salesperson_id: ids["sales@fermier.demo"] }).in("customer_code", ["CUS-DEMO-001", "CUS-DEMO-002"]);
  await admin.from("customers").update({ salesperson_id: ids["salesmanager@fermier.demo"] }).eq("customer_code", "CUS-DEMO-003");

  const { count } = await admin.from("enquiries").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) { log("• transactions already exist — skipping sample workflow"); return; }

  const pid = async (sku: string) => (await admin.from("products").select("id").eq("sku", sku).single()).data!.id as string;
  const buyerA = await as("buyer@sample-builders.demo");
  const buyerB = await as("buyer@demo-agro.demo");
  const sales = await as("sales@fermier.demo");
  const mgr = await as("salesmanager@fermier.demo");
  const inv = await as("inventory@fermier.demo");

  // 1. Completed flow for Sample Builders: request → quote → accept → PO → order → reserve → dispatch → invoice (mock)
  const [r1] = await rpc<{ id: string; enquiry_number: string }[]>(buyerA, "submit_order_request", {
    p_items: [{ product_id: await pid("YT-WN-500P"), quantity: 4 }, { product_id: await pid("YT-MC-FR01"), quantity: 2 }],
    p_delivery_address: "Demo site, Chennai (sample)", p_requested_date: null, p_notes: "Sample request: rooftop lifting for site block B",
  });
  const custA = (await admin.from("customers").select("id").eq("customer_code", "CUS-DEMO-001").single()).data!.id;
  const q1 = await rpc<string>(sales, "save_quotation", { p_id: null,
    p_header: { customer_id: custA, enquiry_id: r1.id, shipping_charges: "1500", payment_terms: "Net 30", delivery_address: "Demo site, Chennai (sample)" },
    p_items: [{ product_id: await pid("YT-WN-500P"), quantity: 4, unit_price: "62500", discount_pct: "5" }, { product_id: await pid("YT-MC-FR01"), quantity: 2, unit_price: "27500" }] });
  await rpc(sales, "transition_quotation", { p_id: q1, p_action: "submit" });
  const st = (await admin.from("quotations").select("status, grand_total").eq("id", q1).single()).data!;
  if (st.status === "pending_approval") await rpc(mgr, "transition_quotation", { p_id: q1, p_action: "approve" });
  await rpc(sales, "transition_quotation", { p_id: q1, p_action: "mark_sent", p_note: "Shared with buyer" });
  await rpc(buyerA, "customer_respond_quotation", { p_id: q1, p_accept: true });
  // Sample PO document (placeholder PDF clearly marked as sample).
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n% SAMPLE PURCHASE ORDER - DEMO DATA ONLY");
  const poPath = `${custA}/purchase-orders/${crypto.randomUUID()}-SAMPLE-PO-1001.pdf`;
  const { error: upErr } = await buyerA.storage.from("customer-documents").upload(poPath, pdf, { contentType: "application/pdf" });
  if (upErr) throw upErr;
  const po1 = await rpc<string>(buyerA, "register_customer_po", { p_quotation: q1, p_po_number: "SAMPLE-PO-1001", p_po_date: new Date().toISOString().slice(0, 10), p_amount: Number(st.grand_total), p_storage_path: poPath, p_file_name: "SAMPLE-PO-1001.pdf", p_notes: "Sample PO" });
  await rpc(mgr, "verify_customer_po", { p_po: po1, p_notes: "Sample: items and quantities match" });
  const so1 = await rpc<string>(mgr, "convert_quotation_to_order", { p_quotation: q1, p_po: po1 });
  await rpc(inv, "reserve_order_stock", { p_order: so1 });
  const lines = (await admin.from("sales_order_items").select("id, quantity").eq("sales_order_id", so1)).data!;
  await rpc(inv, "dispatch_order", { p_order: so1, p_lines: lines.map((l: { id: string; quantity: number }) => ({ item_id: l.id, quantity: Number(l.quantity) })), p_method: "Own truck (sample)", p_tracking: "SAMPLE-LR-001", p_date: null, p_doc_path: null });
  // Simulated (mock-mode) invoice handoff, clearly flagged.
  const { data: so1row } = await admin.from("sales_orders").select("order_number, grand_total").eq("id", so1).single();
  await admin.from("invoices").insert({ sales_order_id: so1, customer_id: custA, provider: "zoho_books", is_mock: true, external_invoice_number: `SIM-${so1row!.order_number}`,
    invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), total: so1row!.grand_total, balance_due: so1row!.grand_total,
    external_status: "simulated", sync_status: "mock", last_synced_at: new Date().toISOString() });
  await admin.from("external_record_mappings").insert({ provider: "zoho_books", entity_type: "invoice", internal_id: so1, external_id: `SIM-${so1row!.order_number}`, is_mock: true });
  await admin.from("integration_jobs").insert({ provider: "zoho_books", job_type: "create_invoice", entity_type: "sales_order", entity_id: so1, idempotency_key: `zoho:invoice:${so1}`, status: "succeeded", attempts: 1 });
  log(`✓ completed sample order ${so1row!.order_number}`);

  // 2. Quotation awaiting the customer (Demo Agro)
  const [r2] = await rpc<{ id: string }[]>(buyerB, "submit_order_request", {
    p_items: [{ product_id: await pid("AK-PWD-7HP"), quantity: 3 }, { product_id: await pid("AK-BC-52"), quantity: 5 }, { product_id: await pid("PM-GEN-7K"), quantity: 1 }],
    p_delivery_address: "Demo godown, Coimbatore (sample)", p_requested_date: null, p_notes: "Sample: monsoon season stock-up",
  });
  const custB = (await admin.from("customers").select("id").eq("customer_code", "CUS-DEMO-002").single()).data!.id;
  const q2 = await rpc<string>(sales, "save_quotation", { p_id: null, p_header: { customer_id: custB, enquiry_id: r2.id, payment_terms: "50% advance, balance before dispatch" },
    p_items: [{ product_id: await pid("AK-PWD-7HP"), quantity: 3, unit_price: "54000", discount_pct: "3" }, { product_id: await pid("AK-BC-52"), quantity: 5, unit_price: "11500" }, { product_id: await pid("PM-GEN-7K"), quantity: 1, unit_price: "185000" }] });
  await rpc(sales, "transition_quotation", { p_id: q2, p_action: "submit" });
  if ((await admin.from("quotations").select("status").eq("id", q2).single()).data!.status === "pending_approval") await rpc(mgr, "transition_quotation", { p_id: q2, p_action: "approve" });
  await rpc(sales, "transition_quotation", { p_id: q2, p_action: "mark_sent" });
  log("✓ quotation awaiting customer response");

  // 3. A fresh order request for the demo to pick up live
  await rpc(buyerA, "submit_order_request", {
    p_items: [{ product_id: await pid("FP-PW-3000"), quantity: 2 }, { product_id: await pid("FP-VC-30L"), quantity: 2 }],
    p_delivery_address: "Demo site, Chennai (sample)", p_requested_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), p_notes: "Sample: new car-wash bay",
  });
  // 4. A website enquiry not yet linked to a customer
  const { data: n } = await admin.rpc("next_document_number", { p_type: "enquiry" });
  await admin.from("enquiries").insert({ enquiry_number: n, source: "website", contact_name: "Sample Website Visitor", contact_email: "visitor@example.com", notes: "Sample: need 2 x 3 kVA generators for a site office" });
  log("✓ open enquiries created\nDone. All records above are sample data.");
}

