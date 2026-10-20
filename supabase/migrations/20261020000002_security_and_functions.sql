-- ============ Role helpers ============
create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

create or replace function has_any_role(rs app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = any(rs))
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select has_any_role(array['super_admin','admin','sales_manager','sales_executive','inventory_manager']::app_role[])
$$;

create or replace function my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from customer_users where user_id = auth.uid()
$$;

-- New auth users get a profile; role assignment is done by admins (or the register action for customers).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','profiles','user_roles','categories','brands','products','product_costs',
    'product_images','product_specifications','product_documents','product_variants','warehouses',
    'inventory_balances','inventory_movements','stock_reservations','customers','customer_users',
    'customer_addresses','customer_activities','suppliers','supplier_products','enquiries','enquiry_items',
    'enquiry_activities','quotations','quotation_items','quotation_versions','customer_purchase_orders',
    'sales_orders','sales_order_items','dispatches','dispatch_items','invoices','integration_connections',
    'integration_secrets','external_record_mappings','integration_jobs','integration_logs','notifications',
    'audit_logs','company_settings','document_sequences']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Reference data readable by any signed-in user
create policy roles_read on roles for select to authenticated using (true);
create policy perms_read on permissions for select to authenticated using (true);
create policy role_perms_read on role_permissions for select to authenticated using (true);

create policy profiles_self on profiles for select to authenticated using (id = auth.uid() or is_staff());
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_admin on profiles for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

create policy user_roles_read on user_roles for select to authenticated using (user_id = auth.uid() or is_staff());
create policy user_roles_super on user_roles for all to authenticated using (has_role('super_admin'));

-- Public catalog: anonymous can read active categories/brands/products, never purchase_cost (handled by view).
create policy categories_public on categories for select using (is_active or is_staff());
create policy categories_staff on categories for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));
create policy brands_public on brands for select using (is_active or is_staff());
create policy brands_staff on brands for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

-- products base table is staff-only; the public reads through catalog_products view.
create policy products_staff_read on products for select to authenticated using (is_staff());
create policy products_staff_write on products for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

create policy costs_read on product_costs for select to authenticated
  using (has_any_role(array['super_admin','admin','inventory_manager']::app_role[]));
create policy costs_write on product_costs for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

create policy pimg_public on product_images for select using (
  exists (select 1 from products p where p.id = product_id and p.status = 'active') or is_staff());
create policy pimg_staff on product_images for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));
create policy pspec_public on product_specifications for select using (
  exists (select 1 from products p where p.id = product_id and p.status = 'active') or is_staff());
create policy pspec_staff on product_specifications for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));
create policy pdoc_public on product_documents for select using (
  exists (select 1 from products p where p.id = product_id and p.status = 'active') or is_staff());
create policy pdoc_staff on product_documents for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));
create policy pvar_public on product_variants for select using (
  exists (select 1 from products p where p.id = product_id and p.status = 'active') or is_staff());
create policy pvar_staff on product_variants for all to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

-- Inventory: staff read; writes only via security-definer functions.
create policy wh_read on warehouses for select to authenticated using (is_staff());
create policy wh_admin on warehouses for all to authenticated using (has_any_role(array['super_admin','admin']::app_role[]));
create policy inv_read on inventory_balances for select to authenticated using (is_staff());
create policy mov_read on inventory_movements for select to authenticated using (is_staff());
create policy res_read on stock_reservations for select to authenticated using (is_staff());

-- Customers: staff see all; customer users see only their own record.
create policy cust_staff on customers for all to authenticated using (is_staff());
create policy cust_self on customers for select to authenticated using (id = my_customer_id());
create policy cu_staff on customer_users for all to authenticated using (is_staff());
create policy cu_self on customer_users for select to authenticated using (user_id = auth.uid());
create policy caddr_staff on customer_addresses for all to authenticated using (is_staff());
create policy caddr_self on customer_addresses for all to authenticated
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy cact_staff on customer_activities for all to authenticated using (is_staff());

create policy sup_staff on suppliers for all to authenticated using (is_staff());
create policy supp_staff on supplier_products for all to authenticated using (is_staff());

-- Enquiries: customers read own; inserts go through submit_order_request().
create policy enq_staff on enquiries for all to authenticated using (is_staff());
create policy enq_self on enquiries for select to authenticated using (customer_id = my_customer_id());
create policy enqi_staff on enquiry_items for all to authenticated using (is_staff());
create policy enqi_self on enquiry_items for select to authenticated using (
  exists (select 1 from enquiries e where e.id = enquiry_id and e.customer_id = my_customer_id()));
create policy enqa_staff on enquiry_activities for all to authenticated using (is_staff());
create policy enqa_self on enquiry_activities for select to authenticated using (
  not is_internal and exists (select 1 from enquiries e where e.id = enquiry_id and e.customer_id = my_customer_id()));

-- Quotations: customers can read their own non-draft quotations only. No customer writes.
create policy qt_staff on quotations for all to authenticated
  using (has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]));
create policy qt_self on quotations for select to authenticated using (
  customer_id = my_customer_id() and status not in ('draft','pending_approval','approved'));
create policy qti_staff on quotation_items for all to authenticated
  using (has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]));
create policy qti_self on quotation_items for select to authenticated using (
  exists (select 1 from quotations q where q.id = quotation_id and q.customer_id = my_customer_id()
          and q.status not in ('draft','pending_approval','approved')));
create policy qtv_staff on quotation_versions for select to authenticated using (is_staff());

create policy cpo_staff on customer_purchase_orders for all to authenticated using (is_staff());
create policy cpo_self on customer_purchase_orders for select to authenticated using (customer_id = my_customer_id());

create policy so_staff on sales_orders for select to authenticated using (is_staff());
create policy so_self on sales_orders for select to authenticated using (customer_id = my_customer_id());
create policy soi_staff on sales_order_items for select to authenticated using (is_staff());
create policy soi_self on sales_order_items for select to authenticated using (
  exists (select 1 from sales_orders s where s.id = sales_order_id and s.customer_id = my_customer_id()));
create policy dsp_staff on dispatches for select to authenticated using (is_staff());
create policy dsp_self on dispatches for select to authenticated using (
  exists (select 1 from sales_orders s where s.id = sales_order_id and s.customer_id = my_customer_id()));
create policy dspi_staff on dispatch_items for select to authenticated using (is_staff());

create policy inv_staff on invoices for select to authenticated using (is_staff());
create policy inv_self on invoices for select to authenticated using (customer_id = my_customer_id());

create policy ic_read on integration_connections for select to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));
-- integration_secrets: intentionally no policies (service role only).
create policy erm_read on external_record_mappings for select to authenticated using (is_staff());
create policy ij_read on integration_jobs for select to authenticated using (is_staff());
create policy il_read on integration_logs for select to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

create policy notif_self on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_mark on notifications for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy audit_read on audit_logs for select to authenticated using (has_role('super_admin'));
create policy settings_read on company_settings for select using (true);
create policy settings_write on company_settings for update to authenticated
  using (has_any_role(array['super_admin','admin']::app_role[]));

-- ============ Public catalog view (no purchase cost) ============
create or replace view catalog_products with (security_invoker = false) as
select p.id, p.sku, p.slug, p.name, p.model_number, p.manufacturer, p.short_description, p.description,
       p.unit, p.tax_rate, p.is_featured, p.created_at, p.updated_at, p.is_sample_data,
       case when p.price_visibility = 'show_price' then p.selling_price end as display_price,
       p.price_visibility,
       c.id as category_id, c.name as category_name, c.slug as category_slug,
       b.id as brand_id, b.name as brand_name, b.slug as brand_slug,
       coalesce(sum(ib.on_hand - ib.reserved), 0) as available_qty,
       (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
left join inventory_balances ib on ib.product_id = p.id
where p.status = 'active'
group by p.id, c.id, b.id;
grant select on catalog_products to anon, authenticated;

-- ============ Audit helper ============
create or replace function write_audit(p_action text, p_entity text, p_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), p_action, p_entity, p_id, p_before, p_after)
$$;

create or replace function audit_product_price() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.selling_price is distinct from old.selling_price or new.status is distinct from old.status
     or new.tax_rate is distinct from old.tax_rate then
    perform write_audit('product.updated', 'product', new.id::text,
      jsonb_build_object('selling_price', old.selling_price, 'tax_rate', old.tax_rate, 'status', old.status),
      jsonb_build_object('selling_price', new.selling_price, 'tax_rate', new.tax_rate, 'status', new.status));
  end if;
  return new;
end $$;
create trigger trg_audit_product after update on products for each row execute function audit_product_price();

create or replace function audit_product_cost() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.purchase_cost is not distinct from old.purchase_cost then return new; end if;
  perform write_audit('product.cost_changed', 'product', new.product_id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('purchase_cost', old.purchase_cost) end,
    jsonb_build_object('purchase_cost', new.purchase_cost));
  return new;
end $$;
create trigger trg_audit_product_cost after insert or update on product_costs for each row execute function audit_product_cost();

create or replace function audit_user_roles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform write_audit(lower(tg_op) || '.user_role', 'user', coalesce(new.user_id, old.user_id)::text,
    case when tg_op = 'DELETE' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger trg_audit_user_roles after insert or delete on user_roles for each row execute function audit_user_roles();

-- ============ Inventory core ============
create or replace function default_warehouse() returns uuid language sql stable as $$
  select id from warehouses where is_default limit 1
$$;

-- Single entry point for every stock change. Locks the balance row to serialise concurrent writers.
create or replace function apply_inventory_movement(
  p_product uuid, p_warehouse uuid, p_type movement_type, p_on_hand_delta numeric, p_reserved_delta numeric,
  p_ref_type text, p_ref_id uuid, p_ref_number text, p_notes text, p_actor uuid
) returns void language plpgsql security definer set search_path = public as $$
declare b inventory_balances; v_allow_neg boolean;
begin
  insert into inventory_balances(product_id, warehouse_id) values (p_product, p_warehouse)
    on conflict do nothing;
  select * into b from inventory_balances where product_id = p_product and warehouse_id = p_warehouse for update;
  select allow_negative_stock into v_allow_neg from company_settings;

  b.on_hand := b.on_hand + p_on_hand_delta;
  b.reserved := b.reserved + p_reserved_delta;
  if b.reserved < 0 then raise exception 'Reserved stock cannot go negative'; end if;
  if not coalesce(v_allow_neg, false) and (b.on_hand < 0 or b.on_hand - b.reserved < 0) then
    raise exception 'INSUFFICIENT_STOCK: product % would go negative (on hand %, reserved %)', p_product, b.on_hand, b.reserved;
  end if;

  update inventory_balances set on_hand = b.on_hand, reserved = b.reserved, updated_at = now(),
    dispatched_total = dispatched_total + case when p_type = 'dispatch' then -p_on_hand_delta else 0 end
   where product_id = p_product and warehouse_id = p_warehouse;

  insert into inventory_movements(product_id, warehouse_id, movement_type, quantity, on_hand_after, reserved_after,
    reference_type, reference_id, reference_number, notes, created_by)
  values (p_product, p_warehouse, p_type,
    case when p_type in ('reservation','reservation_release') then p_reserved_delta else p_on_hand_delta end,
    b.on_hand, b.reserved, p_ref_type, p_ref_id, p_ref_number, p_notes, p_actor);
end $$;

-- Staff-facing manual stock operation.
create or replace function record_stock_movement(p_product uuid, p_type movement_type, p_quantity numeric, p_notes text, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_any_role(array['super_admin','admin','inventory_manager']::app_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if p_type not in ('goods_received','adjustment','return','correction') then
    raise exception 'Only receipts, adjustments, returns and corrections can be recorded manually';
  end if;
  if p_type in ('goods_received','return') and p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_quantity = 0 then raise exception 'Quantity cannot be zero'; end if;
  if p_type in ('adjustment','correction') and coalesce(trim(p_notes),'') = '' then
    raise exception 'A reason is required for adjustments and corrections';
  end if;
  perform apply_inventory_movement(p_product, default_warehouse(), p_type, p_quantity, 0,
    'manual', null, p_reference, p_notes, auth.uid());
  perform write_audit('stock.' || p_type::text, 'product', p_product::text, null,
    jsonb_build_object('quantity', p_quantity, 'notes', p_notes, 'reference', p_reference));
end $$;

-- ============ Order request (customer cart) ============
create or replace function submit_order_request(p_items jsonb, p_delivery_address text, p_requested_date date, p_notes text)
returns table (id uuid, enquiry_number text) language plpgsql security definer set search_path = public as $$
declare v_customer uuid := my_customer_id(); v_id uuid; v_num text; v_item jsonb; v_p products; v_profile profiles;
begin
  if v_customer is null then raise exception 'Only customer accounts can submit order requests'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'Too many items'; end if;
  select * into v_profile from profiles where profiles.id = auth.uid();
  v_num := next_document_number('enquiry');
  insert into enquiries(enquiry_number, customer_id, submitted_by, source, contact_name, contact_email, contact_phone,
    delivery_address, requested_delivery_date, notes, assigned_to)
  select v_num, v_customer, auth.uid(), 'portal', v_profile.full_name, v_profile.email, v_profile.phone,
    p_delivery_address, p_requested_date, p_notes, c.salesperson_id
  from customers c where c.id = v_customer
  returning enquiries.id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_p from products where products.id = (v_item->>'product_id')::uuid and status = 'active';
    if v_p.id is null then raise exception 'Product not available'; end if;
    if (v_item->>'quantity')::numeric <= 0 or (v_item->>'quantity')::numeric > 100000 then
      raise exception 'Invalid quantity for %', v_p.sku;
    end if;
    insert into enquiry_items(enquiry_id, product_id, sku_snapshot, name_snapshot, quantity)
    values (v_id, v_p.id, v_p.sku, v_p.name, (v_item->>'quantity')::numeric);
  end loop;

  insert into enquiry_activities(enquiry_id, activity_type, body, to_status, is_internal, created_by)
  values (v_id, 'status_change', 'Order request submitted from customer portal', 'new', false, auth.uid());
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (v_customer, 'enquiry', 'Order request ' || v_num || ' submitted', 'enquiry', v_id, auth.uid());
  insert into notifications(user_id, event_type, title, body, link)
  select ur.user_id, 'order_request.new', 'New order request ' || v_num,
         (select company_name from customers where customers.id = v_customer), '/admin/enquiries/' || v_id
  from user_roles ur where ur.role in ('admin','sales_manager')
  union
  select c.salesperson_id, 'order_request.new', 'New order request ' || v_num, c.company_name, '/admin/enquiries/' || v_id
  from customers c where c.id = v_customer and c.salesperson_id is not null;

  return query select v_id, v_num;
end $$;

-- ============ Quotation → Sales order ============
create or replace function convert_quotation_to_order(p_quotation uuid, p_po uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare q quotations; po customer_purchase_orders; v_so uuid; v_num text; it record; v_soi uuid; v_wh uuid := default_warehouse();
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into q from quotations where id = p_quotation for update;
  if q.id is null then raise exception 'Quotation not found'; end if;

  -- Idempotent: a repeated conversion returns the existing order.
  select id into v_so from sales_orders where quotation_id = p_quotation;
  if v_so is not null then return v_so; end if;

  if q.status <> 'accepted' then raise exception 'Only accepted quotations can be converted (status: %)', q.status; end if;
  select * into po from customer_purchase_orders where id = p_po;
  if po.id is null or po.quotation_id <> q.id or po.customer_id <> q.customer_id then
    raise exception 'Customer PO does not belong to this quotation';
  end if;
  if po.status <> 'verified' then raise exception 'Customer PO must be verified before confirming the order'; end if;

  v_num := next_document_number('sales_order');
  insert into sales_orders(order_number, customer_id, quotation_id, customer_po_id, currency, subtotal, discount_total,
    tax_total, shipping_charges, other_charges, grand_total, delivery_address, payment_terms, salesperson_id, status,
    requested_delivery_date, created_by)
  select v_num, q.customer_id, q.id, po.id, q.currency, q.subtotal, q.discount_total, q.tax_total, q.shipping_charges,
    q.other_charges, q.grand_total, q.delivery_address, q.payment_terms, c.salesperson_id, 'confirmed',
    e.requested_delivery_date, auth.uid()
  from customers c left join enquiries e on e.id = q.enquiry_id
  where c.id = q.customer_id
  returning id into v_so;

  for it in select * from quotation_items where quotation_id = q.id order by sort_order loop
    insert into sales_order_items(sales_order_id, product_id, sku_snapshot, name_snapshot, description_snapshot, unit,
      quantity, unit_price, discount_pct, tax_rate, line_subtotal, discount_amount, tax_amount, line_total, sort_order)
    values (v_so, it.product_id, it.sku_snapshot, it.name_snapshot, it.description_snapshot, it.unit, it.quantity,
      it.unit_price, it.discount_pct, it.tax_rate, it.line_subtotal, it.discount_amount, it.tax_amount, it.line_total, it.sort_order)
    returning id into v_soi;
  end loop;

  update quotations set status = 'converted' where id = q.id;
  if q.enquiry_id is not null then
    update enquiries set status = 'converted' where id = q.enquiry_id;
  end if;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (q.customer_id, 'sales_order', 'Sales order ' || v_num || ' confirmed from ' || q.quotation_number, 'sales_order', v_so, auth.uid());
  perform write_audit('sales_order.confirmed', 'sales_order', v_so::text, null,
    jsonb_build_object('order_number', v_num, 'quotation', q.quotation_number, 'grand_total', q.grand_total));
  return v_so;
end $$;

-- Reserve all outstanding quantities for an order. All-or-nothing.
create or replace function reserve_order_stock(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare so sales_orders; it record; v_wh uuid := default_warehouse(); v_need numeric;
begin
  if not has_any_role(array['super_admin','admin','sales_manager','inventory_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into so from sales_orders where id = p_order for update;
  if so.status not in ('confirmed') then raise exception 'Stock can only be reserved for confirmed orders (status: %)', so.status; end if;
  for it in select * from sales_order_items where sales_order_id = p_order and product_id is not null order by product_id loop
    v_need := it.quantity - it.dispatched_quantity
      - coalesce((select sum(quantity) from stock_reservations where sales_order_item_id = it.id and status = 'active'), 0);
    if v_need > 0 then
      perform apply_inventory_movement(it.product_id, v_wh, 'reservation', 0, v_need, 'sales_order', so.id, so.order_number,
        'Reserved for ' || so.order_number, auth.uid());
      insert into stock_reservations(product_id, warehouse_id, sales_order_id, sales_order_item_id, quantity)
      values (it.product_id, v_wh, so.id, it.id, v_need);
    end if;
  end loop;
  update sales_orders set status = 'stock_reserved' where id = p_order;
  perform write_audit('stock.reserved', 'sales_order', p_order::text, null, jsonb_build_object('order_number', so.order_number));
end $$;

-- Dispatch: consume reservations and reduce on-hand. p_lines: [{"item_id":..., "quantity":...}]
create or replace function dispatch_order(p_order uuid, p_lines jsonb, p_method text, p_tracking text, p_date date, p_doc_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare so sales_orders; v_disp uuid; v_num text; l jsonb; it sales_order_items; v_qty numeric; v_res stock_reservations;
        v_remaining numeric; v_wh uuid := default_warehouse();
begin
  if not has_any_role(array['super_admin','admin','inventory_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into so from sales_orders where id = p_order for update;
  if so.status not in ('stock_reserved','partially_fulfilled','ready_for_dispatch') then
    raise exception 'Order is not ready for dispatch (status: %)', so.status;
  end if;
  v_num := next_document_number('dispatch');
  insert into dispatches(dispatch_number, sales_order_id, warehouse_id, dispatch_date, delivery_method, tracking_reference, document_path, created_by)
  values (v_num, so.id, v_wh, coalesce(p_date, current_date), p_method, p_tracking, p_doc_path, auth.uid())
  returning id into v_disp;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_qty := (l->>'quantity')::numeric;
    continue when v_qty is null or v_qty = 0;
    if v_qty < 0 then raise exception 'Dispatch quantity cannot be negative'; end if;
    select * into it from sales_order_items where id = (l->>'item_id')::uuid and sales_order_id = so.id for update;
    if it.id is null then raise exception 'Line does not belong to this order'; end if;
    if it.dispatched_quantity + v_qty > it.quantity then
      raise exception 'Cannot dispatch more than ordered for %', it.sku_snapshot;
    end if;
    select * into v_res from stock_reservations where sales_order_item_id = it.id and status = 'active' for update;
    if v_res.id is null or v_res.quantity < v_qty then
      raise exception 'Insufficient reserved stock for %', it.sku_snapshot;
    end if;
    -- consume reservation and physical stock together
    perform apply_inventory_movement(it.product_id, v_wh, 'dispatch', -v_qty, -v_qty, 'dispatch', v_disp, v_num,
      'Dispatched against ' || so.order_number, auth.uid());
    v_remaining := v_res.quantity - v_qty;
    update stock_reservations set quantity = v_remaining,
      status = case when v_remaining = 0 then 'consumed'::reservation_status else 'active'::reservation_status end, updated_at = now()
     where id = v_res.id;
    update sales_order_items set dispatched_quantity = dispatched_quantity + v_qty where id = it.id;
    insert into dispatch_items(dispatch_id, sales_order_item_id, product_id, quantity) values (v_disp, it.id, it.product_id, v_qty);
  end loop;

  if not exists (select 1 from dispatch_items where dispatch_id = v_disp) then
    raise exception 'Enter at least one quantity to dispatch';
  end if;

  update sales_orders set status = case
      when not exists (select 1 from sales_order_items where sales_order_id = so.id and dispatched_quantity < quantity)
        then 'dispatched'::sales_order_status
      else 'partially_fulfilled'::sales_order_status end
   where id = so.id;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (so.customer_id, 'dispatch', 'Dispatch ' || v_num || ' for ' || so.order_number, 'dispatch', v_disp, auth.uid());
  return v_disp;
end $$;

create or replace function cancel_sales_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare so sales_orders; r stock_reservations;
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'A cancellation reason is required'; end if;
  select * into so from sales_orders where id = p_order for update;
  if so.status in ('dispatched','delivered','completed','cancelled') then
    raise exception 'Order in status % cannot be cancelled', so.status;
  end if;
  for r in select * from stock_reservations where sales_order_id = p_order and status = 'active' for update loop
    if r.quantity > 0 then
      perform apply_inventory_movement(r.product_id, r.warehouse_id, 'reservation_release', 0, -r.quantity,
        'sales_order', so.id, so.order_number, 'Released: order cancelled', auth.uid());
    end if;
    update stock_reservations set status = 'released', updated_at = now() where id = r.id;
  end loop;
  update sales_orders set status = 'cancelled', cancelled_reason = p_reason where id = p_order;
  perform write_audit('sales_order.cancelled', 'sales_order', p_order::text,
    jsonb_build_object('status', so.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason));
end $$;

-- Lock down function execution: business functions only for signed-in users; internal helpers not exposed.
revoke execute on function apply_inventory_movement(uuid,uuid,movement_type,numeric,numeric,text,uuid,text,text,uuid) from public, anon, authenticated;
revoke execute on function next_document_number(text) from public, anon, authenticated;
revoke execute on function write_audit(text,text,text,jsonb,jsonb) from public, anon, authenticated;
