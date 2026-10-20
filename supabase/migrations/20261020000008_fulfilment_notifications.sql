create or replace function notify_users(p_users uuid[], p_event text, p_title text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN'; end if;
  insert into notifications(user_id, event_type, title, link)
  select distinct u, p_event, left(p_title, 200), p_link from unnest(p_users) u;
end $$;

create or replace function confirm_delivery(p_dispatch uuid, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare d dispatches; so sales_orders;
begin
  if not has_any_role(array['super_admin','admin','inventory_manager','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into d from dispatches where id = p_dispatch for update;
  if d.id is null then raise exception 'Dispatch not found'; end if;
  if d.delivered_at is not null then raise exception 'Delivery already confirmed'; end if;
  update dispatches set delivered_at = now(), delivery_notes = p_notes where id = p_dispatch;
  select * into so from sales_orders where id = d.sales_order_id for update;
  if so.status = 'dispatched' and not exists (select 1 from dispatches where sales_order_id = so.id and delivered_at is null) then
    update sales_orders set status = 'delivered' where id = so.id;
  end if;
  insert into customer_activities(customer_id, activity_type, summary, reference_type, reference_id, created_by)
  values (so.customer_id, 'delivery', 'Delivery confirmed for ' || d.dispatch_number, 'sales_order', so.id, auth.uid());
end $$;

create or replace function complete_sales_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare so sales_orders;
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into so from sales_orders where id = p_order for update;
  if so.status not in ('delivered','dispatched') then raise exception 'Only dispatched or delivered orders can be completed'; end if;
  update sales_orders set status = 'completed' where id = p_order;
  perform write_audit('sales_order.completed', 'sales_order', p_order::text, jsonb_build_object('status', so.status), jsonb_build_object('status','completed'));
end $$;

-- Customer-facing notifications on order milestones.
create or replace function notify_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_title := case new.status
    when 'confirmed' then 'Order ' || new.order_number || ' confirmed'
    when 'stock_reserved' then 'Stock allocated for order ' || new.order_number
    when 'partially_fulfilled' then 'Part of order ' || new.order_number || ' has been dispatched'
    when 'dispatched' then 'Order ' || new.order_number || ' dispatched'
    when 'delivered' then 'Order ' || new.order_number || ' delivered'
    when 'cancelled' then 'Order ' || new.order_number || ' cancelled'
  end;
  if v_title is not null then
    insert into notifications(user_id, event_type, title, link)
    select cu.user_id, 'sales_order.' || new.status, v_title, '/portal/orders/' || new.id from customer_users cu where cu.customer_id = new.customer_id;
  end if;
  if new.status = 'dispatched' or new.status = 'partially_fulfilled' then
    insert into notifications(user_id, event_type, title, link)
    select new.salesperson_id, 'sales_order.dispatched', v_title, '/admin/sales-orders/' || new.id where new.salesperson_id is not null;
  end if;
  return new;
end $$;
create trigger trg_notify_order_status after update on sales_orders for each row execute function notify_order_status();

create or replace function notify_order_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, event_type, title, link)
  select cu.user_id, 'sales_order.confirmed', 'Order ' || new.order_number || ' confirmed', '/portal/orders/' || new.id
  from customer_users cu where cu.customer_id = new.customer_id;
  insert into notifications(user_id, event_type, title, link)
  select user_id, 'sales_order.confirmed', 'Sales order ' || new.order_number || ' confirmed — reserve stock', '/admin/sales-orders/' || new.id
  from user_roles where role = 'inventory_manager';
  return new;
end $$;
create trigger trg_notify_order_created after insert on sales_orders for each row execute function notify_order_created();

-- Quotation sent → customer notified in portal.
create or replace function notify_quotation_sent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' then
    insert into notifications(user_id, event_type, title, link)
    select cu.user_id, 'quotation.sent', 'New quotation ' || new.quotation_number || ' is ready for review', '/portal/quotations/' || new.id
    from customer_users cu where cu.customer_id = new.customer_id;
  end if;
  return new;
end $$;
create trigger trg_notify_quotation_sent after update on quotations for each row execute function notify_quotation_sent();
