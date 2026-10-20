# Fermier Agency — Equipment Dealership Management System

Catalog, customer portal, inventory, quotations, customer POs, sales orders, dispatch and Zoho Books invoicing for a B2B construction/industrial equipment dealer.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4) · Supabase (Postgres, Auth, Storage, RLS) · Vercel · Zoho Books API · Resend (optional email) · `@react-pdf/renderer`.

> All products, prices, stock, customers and transactions in the seed are **sample data**. No real GSTINs, bank details or company registrations are included.

---

## 1. What's implemented

| Area | Highlights |
|---|---|
| Public catalog | Home (hero, categories, featured, brands, benefits), `/catalog` with search (name/SKU/model/brand), category/brand/price/stock filters, sorting, pagination, removable filter chips, empty states; `/catalog/[category]`; `/products/[slug]` with gallery, grouped specs from the DB, brochures, related items; price-on-request handling; WhatsApp click-to-chat; mobile bottom nav; `/contact` enquiry form (honeypot + rate limit) |
| Auth & roles | Supabase Auth; roles Super Admin, Admin, Sales Manager, Sales Executive, Inventory Manager, Customer. Enforced in **Postgres RLS + security-definer functions** and server actions, not just the UI |
| Admin dashboard | Live metrics from `dashboard_metrics()` (stock value only for cost-authorised roles), 6-month sales, quotation pipeline, order status, low stock, recent activity, integration failures |
| Product master | Table with image/stock/status; create/edit form in 8 sections; dynamic key-value specs; multiple images + PDF brochures (type/size validated); duplicate; activate/deactivate/archive; **CSV import (all-or-nothing, row-level error report, duplicate detection)** and CSV export; purchase cost in a separate RLS-protected table |
| Categories / brands | Add, edit, reorder, (de)activate, subcategories |
| Inventory | Available = on hand − active reservations; movement ledger (receipts, adjustments, returns, corrections, reservations, releases, dispatches) with user/reference/notes; no negative stock unless a Super Admin allows it; row-locked atomic updates; multi-warehouse-ready schema |
| Customers / suppliers | Customer master, delivery addresses, consolidated timeline, quote/order/invoice/PO history, call & note logging, portal login creation. Sales Executives can only edit customers assigned to them. Supplier master with product links and lead times |
| Enquiries | Pipeline statuses, assignment (managers only), follow-ups, call/notes, customer-visible vs internal notes, link to customer, convert to quotation |
| Quotations | Line-item editor with live preview; **authoritative totals recomputed in Postgres `numeric`**; configurable approval (discount % / amount / per-user limit); draft → approval → sent → accepted/rejected/expired → converted; revisions with version snapshots; accepted terms locked by trigger; branded PDF; email via Resend (only reports sent when the provider accepts); WhatsApp share link |
| Customer POs | Upload (PDF/image ≤10 MB) by customer or staff; verification against the accepted quotation (customer, currency, amount, status, document) — discrepancies flagged, never auto-corrected; verified POs immutable |
| Sales orders | Idempotent conversion (one order per quotation); prices frozen by trigger; reserve stock (all-or-nothing, notifies inventory on shortage); partial/full dispatch with documents & tracking; delivery confirmation; cancel with reservation release; complete |
| Zoho Books | OAuth connect (state-checked), token refresh, region-aware URLs, contact match/create, **explicit product→item and GST→tax-ID mapping**, duplicate guard (search by reference before create + persisted mappings), retry with back-off, logs, failure notifications, scheduled payment sync. **Mock mode** creates clearly-labelled `SIM-…` invoices with no external ID |
| Customer portal | Dashboard, catalog, cart → persistent order request with reference number, request tracking, quotation accept/decline, PO upload, order tracking with shipments & documents, invoices (from synced data), profile & addresses |
| Reports | Sales by month/product/category/customer/salesperson, quotation conversion, pending orders, inventory valuation, low stock, stock movements, invoices (unsynced labelled as such); date filters; CSV export |
| System | Users & roles, settings (company profile, approval thresholds, invoice stage), audit log with before/after diffs, in-app notifications |

Tests: `npm test` runs 30+ tests — the full order workflow, overselling prevention, cancellation, approvals, RLS isolation, cost visibility, CSV import atomicity, privilege guards (via embedded Postgres/PGlite), plus PDF rendering, money maths and CSV parsing.

---

## 1a. Real catalogue import (fermieragency.com)

The live catalogue (categories, brands, products, specifications and HD photos) is imported from the public website API:

```bash
python3 -I scripts/scrape-fermier-site.py            # full import → public/catalog/ + supabase/seed-real-catalog.sql
python3 -I scripts/scrape-fermier-site.py --site-images      # hero / about / logo imagery
python3 -I scripts/scrape-fermier-site.py --datasheets-only  # rebuild PDF datasheet images from existing photos
```

Photos are validated, converted to WebP (≤1800 px) and low-resolution duplicates are dropped. `seed-real-catalog.sql` runs after `seed.sql` (see `supabase/config.toml`) and retires the earlier sample catalogue from public view. The website publishes no prices, so all products are "price on request"; opening stock levels are sample values. Every product has a branded PDF data sheet at `/products/<slug>/datasheet`.

## 2. Environment variables

Copy `.env.example` → `.env.local`. Placeholders only:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key        # server only — never exposed to the browser
NEXT_PUBLIC_SITE_URL=http://localhost:4480             # your Vercel URL in production
ZOHO_MODE=mock                                          # informational; mode is set in Admin → Integrations
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_ORGANIZATION_ID=
ZOHO_REGION=in
RESEND_API_KEY=                                         # blank = email disabled (in-app notifications still work)
EMAIL_FROM="Fermier Agency <no-reply@example.com>"
CRON_SECRET=change-me                                   # long random string
```

If the Supabase variables are missing, the app runs in **local demo mode** (next section).

### Local demo mode (no Supabase)

With no `NEXT_PUBLIC_SUPABASE_URL` set, `npm run dev` starts an embedded Postgres (PGlite) in `.data/`, applies the same migrations, RLS policies and seed, and creates the demo accounts and sample orders on first start. Sign-in uses local accounts (signed session cookie), uploads are stored in `.data/storage`. The login page lists one-click demo accounts; password `demo1234` (override with `DEMO_PASSWORD`).

- Reset the demo data: stop the server, `rm -rf .data`, start again.
- Local mode is for demos on one machine. It is not for production or for Vercel, whose serverless filesystem is not persistent. Use Supabase for anything shared.

---

## 3. Database setup & migrations

Migrations live in `supabase/migrations` (schema, RLS, stock & order functions, quotations/POs, storage buckets, reporting, product admin, sales scope, notifications, profile guard). Seed catalog data is `supabase/seed.sql`.

```bash
npm install
supabase login
supabase link --project-ref <your-project-ref>
supabase db push --include-seed
```

New schema changes: `supabase migration new <name>`, write SQL, then `supabase db push`. Run `npm test` first — the test harness applies every migration to an in-memory Postgres.

---

## 4. Demo logins

```bash
DEMO_PASSWORD='choose-a-strong-password' npm run seed:demo
```

Creates these users (all with `DEMO_PASSWORD`) and sample transactions — one completed order with a simulated invoice, a quotation awaiting the customer, an open portal request and an unlinked website enquiry:

| Role | Email |
|---|---|
| Super Admin | superadmin@fermier.demo |
| Admin | admin@fermier.demo |
| Sales Manager | salesmanager@fermier.demo |
| Sales Executive | sales@fermier.demo |
| Inventory Manager | inventory@fermier.demo |
| Customer (Sample Builders) | buyer@sample-builders.demo |
| Customer (Demo Agro) | buyer@demo-agro.demo |

New customers can also self-register at `/register`.

---

## 5. Local development

```bash
npm run dev          # http://localhost:4480
npm test             # database + unit tests (no Supabase needed)
npm run typecheck
npm run lint
npm run build
```

---

## 6. Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (framework: Next.js).
2. Add every variable from section 2 in **Project → Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. In Supabase **Auth → URL configuration**, add the Vercel URL as Site URL / redirect URL.
4. Deploy. `vercel.json` schedules `/api/cron/integrations` every 15 minutes (processes queued invoice jobs and syncs payment status). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Note: Hobby plans only allow daily crons — use Pro, or call the endpoint from an external scheduler.

---

## 7. Connecting Zoho Books

1. In the Zoho API console for your data centre (e.g. `api-console.zoho.in`), create a **Server-based Application**. Redirect URI: `<NEXT_PUBLIC_SITE_URL>/api/integrations/zoho/callback`.
2. Set `ZOHO_CLIENT_ID` and `ZOHO_CLIENT_SECRET`, redeploy.
3. Admin → **Integrations**: choose the data centre, enter the Organisation ID (Zoho Books → Settings → Organisation Profile), save, click **Authorise Zoho Books**, then **Test connection**.
4. **Product & tax mapping** tab: enter the Zoho item ID for each product and the Zoho tax ID for each GST rate in use. Invoicing fails with a clear message until mappings exist — SKUs are never assumed to match.
5. Switch mode to **Live**. Choose the invoicing stage in Settings (on dispatch by default).

Scopes requested: `ZohoBooks.invoices.ALL, ZohoBooks.contacts.ALL, ZohoBooks.settings.READ`. Zoho documents no idempotency key, so duplicates are prevented by (a) one job per order (unique key), (b) persisted invoice mappings, and (c) searching Zoho for an invoice with the order number as `reference_number` before creating. API limit is ~100 requests/minute per organisation; 429/5xx responses are retried with back-off.

---

## 8. Demo walkthrough (≈15 minutes)

1. **Catalog (mobile view)** — open `/` on a phone width: navy header, categories, featured products. Search "winch", filter In-stock, open the *Y-tal 500 kg Winch — Plus*: grouped specs, price + GST, WhatsApp button.
2. **Customer order request** — sign in as `buyer@sample-builders.demo`, add the winch and a frame to the cart, submit → reference number shown; open *Requests* to see live status.
3. **Sales picks it up** — sign in as `sales@fermier.demo`: dashboard shows the new enquiry; open it, log a call, **Create quotation** (items prefilled), add a 5% discount → server recalculates totals. Try 15% → goes to **Sales Manager approval**.
4. **Approval & send** — as `salesmanager@fermier.demo` approve; download the **PDF**; share via WhatsApp link / email; mark sent.
5. **Customer accepts & uploads PO** — as the buyer, accept in the portal and upload a PO. Upload one with a wrong amount first to show it being flagged *requires correction*.
6. **Verify & confirm** — as Sales Manager, verify the PO (side-by-side check), **Confirm sales order**; show prices are locked.
7. **Inventory** — as `inventory@fermier.demo` reserve stock → *available* drops, *on hand* unchanged; dispatch part of the order with a tracking number → movement ledger updates; status *Partially fulfilled*.
8. **Invoice** — dispatch triggers invoice creation: in mock mode a **Simulated** `SIM-…` invoice appears, clearly labelled; show Integrations → Jobs & logs and retry controls.
9. **Customer view** — back as the buyer: order timeline, shipment, invoice. Sign in as `buyer@demo-agro.demo` to show they see none of it.
10. **Oversight** — Reports (sales by customer, conversion, valuation, CSV export), Audit log (price change, reservation, confirmation), Users & roles.

---

## 9. Known limitations / next steps

- **Reference screenshots**: none were attached to the build brief, so the catalog follows the written direction (navy header, centred logo, green actions, card grid, bottom nav) rather than pixel references. No real product photos are included — cards show category-icon placeholders until images are uploaded.
- **Not yet exercised against a live Supabase project or Zoho account** in this build environment (Docker unavailable). Business logic and RLS are covered by the PGlite test suite; run through section 8 once a project is connected.
- Zoho tokens are stored in a table with no RLS policies (service-role only). For production, move them to Supabase Vault/pgsodium encryption.
- Rate limiting is in-memory per server instance; use Upstash/Redis for multi-instance enforcement.
- Email notifications: quotations can be emailed; other events are in-app only (`notifications.email_status` is ready for a queued email worker).
- Customer-specific price lists, product variants UI (table exists), multi-warehouse UI, supplier purchase orders and payment recording are out of current scope.
- "Viewed" quotation status is not tracked (no reliable read tracking without a tracked link service).
