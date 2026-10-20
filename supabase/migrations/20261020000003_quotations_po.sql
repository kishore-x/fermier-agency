-- Create or update a draft quotation. Totals are always recomputed here from product master data + entered
-- quantity/price/discount; nothing monetary is trusted from the client except the entered unit price and discount.
-- p_header: {customer_id, enquiry_id, billing_address, delivery_address, expiry_date, payment_terms, delivery_terms,
--            notes, terms_and_conditions, shipping_charges, other_charges}
-- p_items: [{product_id, quantity, unit_price, discount_pct, description}]
create or replace function save_quotation(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare q quotations; v_id uuid; it jsonb; p products; s company_settings;
        v_qty numeric; v_price numeric; v_disc numeric; v_sub numeric; v_damt numeric; v_tax numeric;
        t_sub numeric := 0; t_disc numeric := 0; t_tax numeric := 0; v_ship numeric; v_other numeric;
        v_max_disc numeric := 0; v_limit numeric; v_order int := 0; v_customer uuid;
begin
  if not has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into s from company_settings;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Add at least one line item'; end if;
  v_customer := (p_header->>'customer_id')::uuid;
  if not exists (select 1 from customers where id = v_customer) then raise exception 'Customer not found'; end if;

  v_ship := round(coalesce((p_header->>'shipping_charges')::numeric, 0), 2);
  v_other := round(coalesce((p_header->>'other_charges')::numeric, 0), 2);
  if v_ship < 0 or v_other < 0 then raise exception 'Charges cannot be negative'; end if;

  if p_id is not null then
    select * into q from quotations where id = p_id for update;
    if q.id is null then raise exception 'Quotation not found'; end if;
    if q.status not in ('draft','pending_approval','approved','sent','rejected') then
      raise exception 'Quotation % is % and can no longer be edited', q.quotation_number, q.status;
    end if;
    -- Editing a quotation that already went out creates a new revision.
    if q.status in ('sent','rejected') then
      update quotations set revision = revision + 1 where id = q.id;
    end if;
    delete from quotation_items where quotation_id = q.id;
    v_id := q.id;
  else
    insert into quotations(quotation_number, customer_id, enquiry_id, created_by, terms_and_conditions, expiry_date)
    values (next_document_number('quotation'), v_customer, nullif(p_header->>'enquiry_id','')::uuid, auth.uid(),
            s.default_terms, current_date + s.quotation_validity_days)
    returning id into v_id;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid;
    if p.id is null then raise exception 'Unknown product in line items'; end if;
    v_qty := (it->>'quantity')::numeric;
    v_price := round(coalesce((it->>'unit_price')::numeric, p.selling_price), 2);
    v_disc := round(coalesce((it->>'discount_pct')::numeric, 0), 2);
    if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero for %', p.sku; end if;
    if v_price is null or v_price < 0 then raise exception 'Enter a unit price for %', p.sku; end if;
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100%% for %', p.sku; end if;
    v_sub := round(v_qty * v_price, 2);
    v_damt := round(v_sub * v_disc / 100, 2);
    v_tax := round((v_sub - v_damt) * p.tax_rate / 100, 2);
    v_order := v_order + 1;
    insert into quotation_items(quotation_id, product_id, sku_snapshot, name_snapshot, description_snapshot, unit, quantity,
      unit_price, discount_pct, tax_rate, line_subtotal, discount_amount, tax_amount, line_total, sort_order)
    values (v_id, p.id, p.sku, p.name, coalesce(nullif(it->>'description',''), p.short_description), p.unit, v_qty,
      v_price, v_disc, p.tax_rate, v_sub, v_damt, v_tax, v_sub - v_damt + v_tax, v_order);
    t_sub := t_sub + v_sub; t_disc := t_disc + v_damt; t_tax := t_tax + v_tax;
    v_max_disc := greatest(v_max_disc, v_disc);
  end loop;

  select discount_limit_pct into v_limit from profiles where id = auth.uid();
  update quotations set
    customer_id = v_customer,
    billing_address = p_header->>'billing_address',
    delivery_address = p_header->>'delivery_address',
    expiry_date = coalesce(nullif(p_header->>'expiry_date','')::date, expiry_date),
    payment_terms = p_header->>'payment_terms',
    delivery_terms = p_header->>'delivery_terms',
    notes = p_header->>'notes',
    terms_and_conditions = coalesce(nullif(p_header->>'terms_and_conditions',''), terms_and_conditions),
    shipping_charges = v_ship, other_charges = v_other,
    subtotal = t_sub, discount_total = t_disc, tax_total = t_tax,
    grand_total = t_sub - t_disc + t_tax + v_ship + v_other,
    requires_approval = (v_max_disc > greatest(s.approval_discount_pct, coalesce(v_limit, 0))
                         or (t_sub - t_disc + t_tax + v_ship + v_other) > s.approval_amount_threshold),
    status = 'draft', approved_by = null, approved_at = null
  where id = v_id;

  if nullif(p_header->>'enquiry_id','') is not null then
    update enquiries set status = 'quotation_in_preparation'
     where id = (p_header->>'enquiry_id')::uuid and status in ('new','assigned','contacted');
  end if;
  return v_id;
end $$;

create or replace function snapshot_quotation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q quotations;
begin
  select * into q from quotations where id = p_id;
  insert into quotation_versions(quotation_id, revision, snapshot, created_by)
  values (q.id, q.revision, jsonb_build_object('header', to_jsonb(q),
    'items', (select jsonb_agg(to_jsonb(i) order by sort_order) from quotation_items i where i.quotation_id = q.id)), auth.uid())
  on conflict (quotation_id, revision) do update set snapshot = excluded.snapshot, created_at = now();
end $$;

-- Lifecycle transitions with role checks. Returns new status.
create or replace function transition_quotation(p_id uuid, p_action text, p_note text default null)
returns quotation_status language plpgsql security definer set search_path = public as $$
declare q quotations; v_new quotation_status; v_is_approver boolean;
begin
  select * into q from quotations where id = p_id for update;
  if q.id is null then raise exception 'Quotation not found'; end if;
  v_is_approver := has_any_role(array['super_admin','admin','sales_manager']::app_role[]);
  if not has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]) then raise exception 'FORBIDDEN'; end if;

  case p_action
    when 'submit' then
      if q.status <> 'draft' then raise exception 'Only drafts can be submitted'; end if;
      v_new := case when q.requires_approval then 'pending_approval' else 'approved' end;
    when 'approve' then
      if not v_is_approver then raise exception 'FORBIDDEN: approval requires Sales Manager or Admin'; end if;
      if q.status <> 'pending_approval' then raise exception 'Quotation is not awaiting approval'; end if;
      v_new := 'approved';
      update quotations set approved_by = auth.uid(), approved_at = now() where id = p_id;
    when 'reject_approval' then
      if not v_is_approver then raise exception 'FORBIDDEN'; end if;
      if q.status <> 'pending_approval' then raise exception 'Quotation is not awaiting approval'; end if;
      v_new := 'draft';
    when 'mark_sent' then
      if q.status not in ('approved','sent') then raise exception 'Quotation must be approved before sending'; end if;
      v_new := 'sent';
      perform snapshot_quotation(p_id);
      update quotations set sent_at = now() where id = p_id;
      if q.enquiry_id is not null then
        update enquiries set status = 'quotation_sent' where id = q.enquiry_id and status not in ('converted','closed');
      end if;
    when 'accept' then
      if q.status not in ('sent','viewed') then raise exception 'Only sent quotations can be accepted'; end if;
      if q.expiry_date < current_date then raise exception 'Quotation expired on %', q.expiry_date; end if;
      v_new := 'accepted';
      update quotations set responded_at = now() where id = p_id;
      perform snapshot_quotation(p_id);
      if q.enquiry_id is not null then update enquiries set status = 'accepted' where id = q.enquiry_id; end if;
    when 'reject' then
      if q.status not in ('sent','viewed') then raise exception 'Only sent quotations can be rejected'; end if;
      v_new := 'rejected';
      update quotations set responded_at = now() where id = p_id;
      if q.enquiry_id is not null then update enquiries set status = 'rejected' where id = q.enquiry_id; end if;
    when 'expire' then
      if q.status not in ('sent','viewed','approved') then raise exception 'Cannot expire from %', q.status; end if;
      v_new := 'expired';
    else raise exception 'Unknown action %', p_action;
  end case;

  update quotations set status = v_new where id = p_id;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (q.customer_id, 'quotation', q.quotation_number || ' → ' || v_new || coalesce(' — ' || p_note, ''), 'quotation', q.id, auth.uid());
  perform write_audit('quotation.' || p_action, 'quotation', p_id::text,
    jsonb_build_object('status', q.status), jsonb_build_object('status', v_new, 'note', p_note));

  if v_new = 'pending_approval' then
    insert into notifications(user_id, event_type, title, link)
    select user_id, 'quotation.approval_required', q.quotation_number || ' needs approval', '/admin/quotations/' || q.id
    from user_roles where role in ('sales_manager','admin');
  end if;
  return v_new;
end $$;

-- Customer-side accept/reject from the portal (own quotations only).
create or replace function customer_respond_quotation(p_id uuid, p_accept boolean)
returns quotation_status language plpgsql security definer set search_path = public as $$
declare q quotations; v_new quotation_status;
begin
  select * into q from quotations where id = p_id for update;
  if q.id is null or q.customer_id is distinct from my_customer_id() then raise exception 'Quotation not found'; end if;
  if q.status not in ('sent','viewed') then raise exception 'This quotation can no longer be responded to'; end if;
  if p_accept and q.expiry_date < current_date then raise exception 'Quotation expired on %', q.expiry_date; end if;
  v_new := case when p_accept then 'accepted' else 'rejected' end;
  update quotations set status = v_new, responded_at = now() where id = p_id;
  if p_accept then perform snapshot_quotation(p_id); end if;
  if q.enquiry_id is not null then update enquiries set status = v_new::text::enquiry_status where id = q.enquiry_id; end if;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (q.customer_id, 'quotation', 'Customer ' || v_new || ' ' || q.quotation_number, 'quotation', q.id, auth.uid());
  insert into notifications(user_id, event_type, title, link)
  select user_id, 'quotation.' || v_new, q.quotation_number || ' was ' || v_new || ' by the customer', '/admin/quotations/' || q.id
  from user_roles where role in ('sales_manager','admin')
  union select created_by, 'quotation.' || v_new, q.quotation_number || ' was ' || v_new || ' by the customer', '/admin/quotations/' || q.id
  from quotations where id = q.id and created_by is not null;
  return v_new;
end $$;

-- Register an uploaded customer PO (staff or the customer themself).
create or replace function register_customer_po(p_quotation uuid, p_po_number text, p_po_date date, p_amount numeric,
  p_storage_path text, p_file_name text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare q quotations; v_id uuid;
begin
  select * into q from quotations where id = p_quotation;
  if q.id is null then raise exception 'Quotation not found'; end if;
  if not is_staff() and q.customer_id is distinct from my_customer_id() then raise exception 'Quotation not found'; end if;
  if q.status not in ('accepted') then raise exception 'A PO can only be attached to an accepted quotation'; end if;
  if coalesce(trim(p_po_number),'') = '' then raise exception 'PO number is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'PO amount must be greater than zero'; end if;
  insert into customer_purchase_orders(customer_id, quotation_id, po_number, po_date, po_amount, currency,
    storage_path, file_name, notes, uploaded_by)
  values (q.customer_id, q.id, trim(p_po_number), p_po_date, round(p_amount, 2), q.currency,
    p_storage_path, p_file_name, p_notes, auth.uid())
  returning id into v_id;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (q.customer_id, 'purchase_order', 'Customer PO ' || p_po_number || ' received for ' || q.quotation_number,
    'customer_purchase_order', v_id, auth.uid());
  insert into notifications(user_id, event_type, title, link)
  select user_id, 'customer_po.received', 'Customer PO ' || p_po_number || ' received', '/admin/purchase-orders/' || v_id
  from user_roles where role in ('sales_manager','admin');
  return v_id;
end $$;

-- Verify PO against accepted quotation. Returns list of discrepancies; status set accordingly.
create or replace function verify_customer_po(p_po uuid, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare po customer_purchase_orders; q quotations; v_issues jsonb := '[]'::jsonb;
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into po from customer_purchase_orders where id = p_po for update;
  if po.id is null then raise exception 'PO not found'; end if;
  if po.status = 'verified' then raise exception 'PO is already verified'; end if;
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
  perform write_audit('customer_po.verify', 'customer_purchase_order', p_po::text, null,
    jsonb_build_object('issues', v_issues));
  return v_issues;
end $$;

-- Approved PO documents cannot be replaced or deleted.
create or replace function protect_verified_po() returns trigger language plpgsql as $$
begin
  if old.status = 'verified' and (tg_op = 'DELETE' or new.storage_path is distinct from old.storage_path
     or new.po_amount is distinct from old.po_amount or new.po_number is distinct from old.po_number) then
    raise exception 'Verified purchase orders cannot be modified or deleted';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_protect_po before update or delete on customer_purchase_orders
  for each row execute function protect_verified_po();

-- Accepted/converted quotation commercial terms are frozen.
create or replace function protect_accepted_quotation() returns trigger language plpgsql as $$
begin
  if old.status in ('accepted','converted') and (new.grand_total is distinct from old.grand_total
     or new.subtotal is distinct from old.subtotal or new.customer_id is distinct from old.customer_id
     or new.payment_terms is distinct from old.payment_terms) then
    raise exception 'Accepted quotations cannot be changed';
  end if;
  return new;
end $$;
create trigger trg_protect_quotation before update on quotations for each row execute function protect_accepted_quotation();

create or replace function protect_accepted_quotation_items() returns trigger language plpgsql as $$
declare v_status quotation_status;
begin
  select status into v_status from quotations where id = coalesce(new.quotation_id, old.quotation_id);
  if v_status in ('accepted','converted') then raise exception 'Accepted quotations cannot be changed'; end if;
  return coalesce(new, old);
end $$;
create trigger trg_protect_quotation_items before insert or update or delete on quotation_items
  for each row execute function protect_accepted_quotation_items();

-- Sales order items carry confirmed prices: no updates except dispatched_quantity.
create or replace function protect_so_items() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Sales order lines cannot be deleted'; end if;
  if (new.unit_price, new.quantity, new.discount_pct, new.tax_rate, new.line_total)
     is distinct from (old.unit_price, old.quantity, old.discount_pct, old.tax_rate, old.line_total) then
    raise exception 'Confirmed sales order pricing cannot be changed';
  end if;
  return new;
end $$;
create trigger trg_protect_so_items before update or delete on sales_order_items for each row execute function protect_so_items();

-- Enquiry status change (staff), with activity trail
create or replace function update_enquiry(p_id uuid, p_status enquiry_status, p_assigned uuid, p_note text, p_follow_up timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare e enquiries;
begin
  if not has_any_role(array['super_admin','admin','sales_manager','sales_executive']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into e from enquiries where id = p_id for update;
  if e.id is null then raise exception 'Enquiry not found'; end if;
  if p_assigned is distinct from e.assigned_to and not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then
    raise exception 'FORBIDDEN: only managers can reassign enquiries';
  end if;
  update enquiries set
    status = coalesce(p_status, status),
    assigned_to = p_assigned,
    next_follow_up_at = p_follow_up
  where id = p_id;
  if p_status is not null and p_status <> e.status then
    insert into enquiry_activities(enquiry_id, activity_type, body, from_status, to_status, is_internal, created_by)
    values (p_id, 'status_change', p_note, e.status, p_status, false, auth.uid());
  elsif coalesce(trim(p_note),'') <> '' then
    insert into enquiry_activities(enquiry_id, activity_type, body, is_internal, created_by)
    values (p_id, 'note', p_note, true, auth.uid());
  end if;
  if p_assigned is distinct from e.assigned_to and p_assigned is not null then
    insert into enquiry_activities(enquiry_id, activity_type, body, is_internal, created_by)
    values (p_id, 'assignment', 'Assigned', true, auth.uid());
    insert into notifications(user_id, event_type, title, link)
    values (p_assigned, 'enquiry.assigned', 'Enquiry ' || e.enquiry_number || ' assigned to you', '/admin/enquiries/' || p_id);
  end if;
end $$;
