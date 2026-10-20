-- Fermier Agency — core schema
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============ Enums ============
create type app_role as enum ('super_admin','admin','sales_manager','sales_executive','inventory_manager','customer');
create type product_status as enum ('draft','active','inactive','archived');
create type price_visibility as enum ('show_price','on_request');
create type movement_type as enum ('goods_received','adjustment','reservation','reservation_release','dispatch','return','correction');
create type reservation_status as enum ('active','released','consumed');
create type enquiry_status as enum ('new','assigned','contacted','quotation_in_preparation','quotation_sent','awaiting_response','accepted','rejected','converted','closed');
create type quotation_status as enum ('draft','pending_approval','approved','sent','viewed','accepted','rejected','expired','converted');
create type po_status as enum ('received','verified','requires_correction');
create type sales_order_status as enum ('pending_confirmation','confirmed','stock_reserved','partially_fulfilled','ready_for_dispatch','dispatched','delivered','completed','cancelled');
create type invoice_sync_status as enum ('pending','mock','created','failed');
create type job_status as enum ('pending','processing','succeeded','failed');

-- ============ Shared helpers ============
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table document_sequences (
  doc_type text primary key,
  prefix text not null,
  next_value bigint not null default 1
);
insert into document_sequences values
  ('enquiry','ENQ',1),('quotation','QT',1),('sales_order','SO',1),
  ('dispatch','DSP',1),('customer','CUS',1),('supplier','SUP',1);

create or replace function next_document_number(p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare v_prefix text; v_val bigint;
begin
  update document_sequences set next_value = next_value + 1
   where doc_type = p_type returning prefix, next_value - 1 into v_prefix, v_val;
  if v_prefix is null then raise exception 'Unknown document type %', p_type; end if;
  return v_prefix || '-' || to_char(now(),'YY') || '-' || lpad(v_val::text, 5, '0');
end $$;

-- ============ Identity & access ============
create table roles (
  key app_role primary key,
  label text not null,
  description text
);
insert into roles values
  ('super_admin','Super Admin','Full system access'),
  ('admin','Admin','Operational management'),
  ('sales_manager','Sales Manager','Pipeline oversight and approvals'),
  ('sales_executive','Sales Executive','Customer and quotation handling'),
  ('inventory_manager','Inventory Manager','Stock and dispatch'),
  ('customer','Customer','Customer portal access');

create table permissions (
  key text primary key,
  description text not null
);

create table role_permissions (
  role app_role references roles(key) on delete cascade,
  permission text references permissions(key) on delete cascade,
  primary key (role, permission)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  is_active boolean not null default true,
  discount_limit_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

create table user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role app_role references roles(key),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ============ Catalog ============
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_categories_updated before update on categories for each row execute function set_updated_at();

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_brands_updated before update on brands for each row execute function set_updated_at();

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  brand_id uuid references brands(id),
  manufacturer text,
  category_id uuid references categories(id),
  subcategory_id uuid references categories(id),
  model_number text,
  short_description text,
  description text,
  unit text not null default 'Nos',
  selling_price numeric(14,2),
  purchase_cost numeric(14,2),
  tax_rate numeric(5,2) not null default 18.00,
  hsn_code text,
  price_visibility price_visibility not null default 'show_price',
  reorder_threshold numeric(12,2) not null default 0,
  is_featured boolean not null default false,
  status product_status not null default 'draft',
  is_sample_data boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_price_nonneg check (selling_price is null or selling_price >= 0),
  constraint chk_tax check (tax_rate between 0 and 100)
);
create trigger trg_products_updated before update on products for each row execute function set_updated_at();
create index idx_products_category on products(category_id);
create index idx_products_brand on products(brand_id);
create index idx_products_status on products(status);
create index idx_products_search on products using gin ((name || ' ' || sku || ' ' || coalesce(model_number,'')) gin_trgm_ops);

-- Purchase cost is staff-only: expose public fields through a view.
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  storage_path text,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_product_images_product on product_images(product_id);

create table product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  spec_group text not null default 'General',
  label text not null,
  value text not null,
  sort_order int not null default 0
);
create index idx_product_specs_product on product_specifications(product_id);

create table product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  storage_path text not null,
  file_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  attributes jsonb not null default '{}',
  price_delta numeric(14,2) not null default 0,
  is_active boolean not null default true
);

-- ============ Inventory ============
create table warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  is_default boolean not null default false,
  is_active boolean not null default true
);
create unique index uq_default_warehouse on warehouses(is_default) where is_default;

create table inventory_balances (
  product_id uuid references products(id) on delete cascade,
  warehouse_id uuid references warehouses(id),
  on_hand numeric(12,2) not null default 0,
  reserved numeric(12,2) not null default 0,
  incoming numeric(12,2) not null default 0,
  dispatched_total numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (product_id, warehouse_id),
  constraint chk_reserved_nonneg check (reserved >= 0)
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  warehouse_id uuid not null references warehouses(id),
  movement_type movement_type not null,
  quantity numeric(12,2) not null,
  on_hand_after numeric(12,2) not null,
  reserved_after numeric(12,2) not null,
  reference_type text,
  reference_id uuid,
  reference_number text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_movements_product on inventory_movements(product_id, created_at desc);

-- ============ Customers & suppliers ============
create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  company_name text not null,
  customer_type text not null default 'business',
  primary_contact text,
  email text,
  phone text,
  gstin text,
  billing_address text,
  state text,
  country text not null default 'India',
  payment_terms text not null default 'Net 30',
  credit_limit numeric(14,2),
  salesperson_id uuid references profiles(id),
  status text not null default 'active',
  internal_notes text,
  is_sample_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_customers_updated before update on customers for each row execute function set_updated_at();
create index idx_customers_name on customers using gin (company_name gin_trgm_ops);

create table customer_users (
  user_id uuid primary key references profiles(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null default 'Delivery',
  line1 text not null,
  line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'India',
  is_default boolean not null default false
);

create table customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  activity_type text not null,
  summary text not null,
  reference_type text,
  reference_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_customer_activities on customer_activities(customer_id, created_at desc);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text,
  payment_terms text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_suppliers_updated before update on suppliers for each row execute function set_updated_at();

create table supplier_products (
  supplier_id uuid references suppliers(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  supplier_sku text,
  lead_time_days int,
  primary key (supplier_id, product_id)
);

-- ============ Sales pipeline ============
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_number text not null unique,
  customer_id uuid references customers(id),
  submitted_by uuid references profiles(id),
  source text not null default 'portal',
  contact_name text,
  contact_email text,
  contact_phone text,
  delivery_address text,
  requested_delivery_date date,
  notes text,
  status enquiry_status not null default 'new',
  assigned_to uuid references profiles(id),
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_enquiries_updated before update on enquiries for each row execute function set_updated_at();
create index idx_enquiries_customer on enquiries(customer_id);
create index idx_enquiries_status on enquiries(status);

create table enquiry_items (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  product_id uuid references products(id),
  sku_snapshot text not null,
  name_snapshot text not null,
  quantity numeric(12,2) not null check (quantity > 0)
);

create table enquiry_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  activity_type text not null,
  body text,
  from_status enquiry_status,
  to_status enquiry_status,
  is_internal boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  revision int not null default 1,
  enquiry_id uuid references enquiries(id),
  customer_id uuid not null references customers(id),
  billing_address text,
  delivery_address text,
  quotation_date date not null default current_date,
  expiry_date date not null default (current_date + 30),
  currency char(3) not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  shipping_charges numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  payment_terms text,
  delivery_terms text,
  notes text,
  terms_and_conditions text,
  status quotation_status not null default 'draft',
  requires_approval boolean not null default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_quotations_updated before update on quotations for each row execute function set_updated_at();
create index idx_quotations_customer on quotations(customer_id);
create index idx_quotations_status on quotations(status);

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  product_id uuid references products(id),
  sku_snapshot text not null,
  name_snapshot text not null,
  description_snapshot text,
  unit text not null default 'Nos',
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  tax_rate numeric(5,2) not null default 18,
  line_subtotal numeric(14,2) not null,
  discount_amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  line_total numeric(14,2) not null,
  sort_order int not null default 0
);

create table quotation_versions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  revision int not null,
  snapshot jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (quotation_id, revision)
);

create table customer_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  quotation_id uuid not null references quotations(id),
  po_number text not null,
  po_date date not null,
  po_amount numeric(14,2) not null,
  currency char(3) not null default 'INR',
  storage_path text,
  file_name text,
  notes text,
  status po_status not null default 'received',
  verification_notes text,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, po_number)
);
create trigger trg_cpo_updated before update on customer_purchase_orders for each row execute function set_updated_at();

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references customers(id),
  quotation_id uuid not null unique references quotations(id),
  customer_po_id uuid references customer_purchase_orders(id),
  order_date date not null default current_date,
  requested_delivery_date date,
  currency char(3) not null default 'INR',
  subtotal numeric(14,2) not null,
  discount_total numeric(14,2) not null,
  tax_total numeric(14,2) not null,
  shipping_charges numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null,
  delivery_address text,
  payment_terms text,
  salesperson_id uuid references profiles(id),
  status sales_order_status not null default 'confirmed',
  cancelled_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_so_updated before update on sales_orders for each row execute function set_updated_at();
create index idx_so_customer on sales_orders(customer_id);
create index idx_so_status on sales_orders(status);

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid references products(id),
  sku_snapshot text not null,
  name_snapshot text not null,
  description_snapshot text,
  unit text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  dispatched_quantity numeric(12,2) not null default 0,
  unit_price numeric(14,2) not null,
  discount_pct numeric(5,2) not null,
  tax_rate numeric(5,2) not null,
  line_subtotal numeric(14,2) not null,
  discount_amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  line_total numeric(14,2) not null,
  sort_order int not null default 0,
  constraint chk_dispatch_le_qty check (dispatched_quantity <= quantity)
);

create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  warehouse_id uuid not null references warehouses(id),
  sales_order_id uuid not null references sales_orders(id),
  sales_order_item_id uuid not null references sales_order_items(id),
  quantity numeric(12,2) not null check (quantity >= 0),
  status reservation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_reservations_order on stock_reservations(sales_order_id);

create table dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_number text not null unique,
  sales_order_id uuid not null references sales_orders(id),
  warehouse_id uuid not null references warehouses(id),
  dispatch_date date not null default current_date,
  delivery_method text,
  tracking_reference text,
  document_path text,
  delivered_at timestamptz,
  delivery_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table dispatch_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references dispatches(id) on delete cascade,
  sales_order_item_id uuid not null references sales_order_items(id),
  product_id uuid not null references products(id),
  quantity numeric(12,2) not null check (quantity > 0)
);

-- ============ Invoicing & integrations ============
create table invoices (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id),
  customer_id uuid not null references customers(id),
  provider text not null default 'zoho_books',
  is_mock boolean not null default false,
  external_invoice_id text,
  external_invoice_number text,
  external_url text,
  invoice_date date,
  due_date date,
  total numeric(14,2),
  balance_due numeric(14,2),
  external_status text,
  sync_status invoice_sync_status not null default 'pending',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_order_id, provider)
);
create trigger trg_invoices_updated before update on invoices for each row execute function set_updated_at();

create table integration_connections (
  provider text primary key,
  mode text not null default 'mock' check (mode in ('mock','live')),
  organization_id text,
  region text not null default 'in',
  is_connected boolean not null default false,
  token_expires_at timestamptz,
  settings jsonb not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
-- Secrets live in a table with no RLS policies (service-role only).
create table integration_secrets (
  provider text primary key references integration_connections(provider) on delete cascade,
  refresh_token text,
  access_token text,
  updated_at timestamptz not null default now()
);

create table external_record_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  entity_type text not null,
  internal_id uuid not null,
  external_id text not null,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, entity_type, internal_id)
);

create table integration_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  job_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  idempotency_key text not null unique,
  status job_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_jobs_updated before update on integration_jobs for each row execute function set_updated_at();

create table integration_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  job_id uuid references integration_jobs(id) on delete set null,
  level text not null default 'info',
  message text not null,
  request_summary jsonb,
  response_summary jsonb,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  audience_role app_role,
  event_type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  email_status text not null default 'not_configured',
  email_attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on audit_logs(entity_type, entity_id);

create table company_settings (
  id boolean primary key default true check (id),
  company_name text not null,
  legal_name text,
  address text,
  phone text,
  email text,
  whatsapp_number text,
  gstin text,
  logo_url text,
  timezone text not null default 'Asia/Kolkata',
  currency char(3) not null default 'INR',
  default_terms text,
  quotation_validity_days int not null default 30,
  approval_discount_pct numeric(5,2) not null default 10,
  approval_amount_threshold numeric(14,2) not null default 500000,
  invoice_stage text not null default 'on_dispatch' check (invoice_stage in ('on_confirmation','on_dispatch')),
  allow_negative_stock boolean not null default false,
  updated_at timestamptz not null default now()
);
