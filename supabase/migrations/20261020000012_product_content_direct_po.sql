-- Rich product content (rendered on the product page; edited in the admin product form)
alter table products
  add column features text[] not null default '{}',
  add column applications text[] not null default '{}',
  add column in_the_box text[] not null default '{}',
  add column warranty text;

create or replace view catalog_products with (security_invoker = false) as
select p.id, p.sku, p.slug, p.name, p.model_number, p.manufacturer, p.short_description, p.description,
       p.unit, p.tax_rate, p.is_featured, p.created_at, p.updated_at, p.is_sample_data,
       case when p.price_visibility = 'show_price' then p.selling_price end as display_price,
       p.price_visibility,
       c.id as category_id, c.name as category_name, c.slug as category_slug,
       b.id as brand_id, b.name as brand_name, b.slug as brand_slug,
       coalesce(sum(ib.on_hand - ib.reserved), 0) as available_qty,
       (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url,
       p.featured_rank, p.features, p.applications, p.in_the_box, p.warranty, p.hsn_code
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
left join inventory_balances ib on ib.product_id = p.id
where p.status = 'active'
group by p.id, c.id, b.id;

-- ===== Direct purchase orders raised by customers from a product page =====
-- A direct PO is received before any quotation exists. It is tied to an order request (enquiry) and must be
-- linked to the accepted quotation before verification, so the "verify against accepted quotation" rule still holds.
alter table customer_purchase_orders alter column quotation_id drop not null;
alter table customer_purchase_orders add column enquiry_id uuid references enquiries(id);
alter table customer_purchase_orders add column is_direct boolean not null default false;
alter table customer_purchase_orders add constraint chk_po_source check (quotation_id is not null or enquiry_id is not null);

create or replace function submit_direct_po(
  p_product uuid, p_quantity numeric, p_po_number text, p_po_date date, p_amount numeric,
  p_delivery_address text, p_requested_date date, p_notes text, p_storage_path text, p_file_name text
) returns table (po_id uuid, enquiry_id uuid, enquiry_number text)
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := my_customer_id(); v_p products; v_enq uuid; v_num text; v_po uuid; v_cust customers;
begin
  if v_customer is null then raise exception 'Only customer accounts can raise purchase orders'; end if;
  select * into v_p from products where id = p_product and status = 'active';
  if v_p.id is null then raise exception 'Product not available'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100000 then raise exception 'Enter a valid quantity'; end if;
  if coalesce(trim(p_po_number), '') = '' then raise exception 'PO number is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'PO amount must be greater than zero'; end if;
  if coalesce(trim(p_delivery_address), '') = '' then raise exception 'Delivery address is required'; end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_customer::text then
    raise exception 'Attach your purchase order document';
  end if;
  select * into v_cust from customers where id = v_customer;

  v_num := next_document_number('enquiry');
  insert into enquiries(enquiry_number, customer_id, submitted_by, source, contact_name, contact_email, contact_phone,
    delivery_address, requested_delivery_date, notes, assigned_to)
  select v_num, v_customer, auth.uid(), 'purchase_order', pr.full_name, pr.email, pr.phone, left(p_delivery_address, 500),
    p_requested_date, concat_ws(E'\n', 'Direct purchase order ' || trim(p_po_number) || ' raised from the product page.', nullif(left(p_notes, 2000), '')),
    v_cust.salesperson_id
  from profiles pr where pr.id = auth.uid()
  returning id into v_enq;
  insert into enquiry_items(enquiry_id, product_id, sku_snapshot, name_snapshot, quantity)
  values (v_enq, v_p.id, v_p.sku, v_p.name, p_quantity);
  insert into enquiry_activities(enquiry_id, activity_type, body, to_status, is_internal, created_by)
  values (v_enq, 'status_change', 'Purchase order ' || trim(p_po_number) || ' submitted by customer', 'new', false, auth.uid());

  insert into customer_purchase_orders(customer_id, quotation_id, enquiry_id, is_direct, po_number, po_date, po_amount,
    storage_path, file_name, notes, uploaded_by)
  values (v_customer, null, v_enq, true, trim(p_po_number), p_po_date, round(p_amount, 2), p_storage_path,
    left(p_file_name, 200), left(p_notes, 1000), auth.uid())
  returning id into v_po;

  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (v_customer, 'purchase_order', 'Direct PO ' || trim(p_po_number) || ' for ' || p_quantity || ' x ' || v_p.name,
    'customer_purchase_order', v_po, auth.uid());

  insert into notifications(user_id, event_type, title, body, link)
  select distinct u, 'customer_po.received', 'Purchase order ' || trim(p_po_number) || ' received — ' || v_cust.company_name,
    p_quantity || ' x ' || v_p.name || ' · ₹' || round(p_amount, 2), '/admin/purchase-orders/' || v_po
  from (select user_id as u from user_roles where role in ('admin', 'sales_manager', 'super_admin')
        union select v_cust.salesperson_id where v_cust.salesperson_id is not null) x;

  return query select v_po, v_enq, v_num;
end $$;

-- Link a direct PO to the accepted quotation prepared for it (staff).
create or replace function link_po_to_quotation(p_po uuid, p_quotation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare po customer_purchase_orders; q quotations;
begin
  if not has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into po from customer_purchase_orders where id = p_po for update;
  if po.id is null then raise exception 'PO not found'; end if;
  if po.status = 'verified' then raise exception 'Verified purchase orders cannot be modified or deleted'; end if;
  select * into q from quotations where id = p_quotation;
  if q.id is null or q.customer_id <> po.customer_id then raise exception 'Quotation does not belong to this customer'; end if;
  if q.status <> 'accepted' then raise exception 'Link the PO to an accepted quotation'; end if;
  update customer_purchase_orders set quotation_id = q.id, status = 'received' where id = p_po;
  perform write_audit('customer_po.linked', 'customer_purchase_order', p_po::text, null, jsonb_build_object('quotation', q.quotation_number));
end $$;

-- Verification needs a linked quotation.
create or replace function verify_customer_po(p_po uuid, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare po customer_purchase_orders; q quotations; v_issues jsonb := '[]'::jsonb;
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into po from customer_purchase_orders where id = p_po for update;
  if po.id is null then raise exception 'PO not found'; end if;
  if po.status = 'verified' then raise exception 'PO is already verified'; end if;
  if po.quotation_id is null then raise exception 'Link this direct PO to the accepted quotation before verifying'; end if;
  select * into q from quotations where id = po.quotation_id;
  if po.customer_id <> q.customer_id then v_issues := v_issues || '"Customer does not match quotation"'::jsonb; end if;
  if po.currency <> q.currency then v_issues := v_issues || to_jsonb('Currency ' || po.currency || ' ≠ quotation ' || q.currency); end if;
  if po.po_amount <> q.grand_total then
    v_issues := v_issues || to_jsonb('PO amount ' || po.po_amount || ' ≠ quotation total ' || q.grand_total);
  end if;
  if q.status <> 'accepted' then v_issues := v_issues || to_jsonb('Quotation status is ' || q.status); end if;
  if po.storage_path is null then v_issues := v_issues || '"No PO document uploaded"'::jsonb; end if;

  update customer_purchase_orders set
    status = case when jsonb_array_length(v_issues) = 0 then 'verified'::po_status else 'requires_correction'::po_status end,
    verification_notes = concat_ws(E'\n', nullif(p_notes,''), case when jsonb_array_length(v_issues) > 0
      then 'Discrepancies: ' || (select string_agg(x, '; ') from jsonb_array_elements_text(v_issues) x) end),
    verified_by = auth.uid(), verified_at = now()
  where id = p_po;
  perform write_audit('customer_po.verify', 'customer_purchase_order', p_po::text, null, jsonb_build_object('issues', v_issues));
  return v_issues;
end $$;
