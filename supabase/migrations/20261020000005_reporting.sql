-- Staff-facing stock view (no cost). security_invoker so RLS of the caller applies.
create or replace view inventory_overview with (security_invoker = true) as
select p.id as product_id, p.sku, p.name, p.slug, p.status, p.reorder_threshold, p.unit, p.selling_price,
       c.name as category_name, b.name as brand_name,
       coalesce(sum(ib.on_hand), 0) as on_hand,
       coalesce(sum(ib.reserved), 0) as reserved,
       coalesce(sum(ib.on_hand - ib.reserved), 0) as available,
       coalesce(sum(ib.incoming), 0) as incoming,
       coalesce(sum(ib.dispatched_total), 0) as dispatched_total,
       max(ib.updated_at) as stock_updated_at, p.updated_at
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
left join inventory_balances ib on ib.product_id = p.id
group by p.id, c.name, b.name;

create or replace function dashboard_metrics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_cost boolean;
begin
  if not is_staff() then raise exception 'FORBIDDEN'; end if;
  v_cost := has_any_role(array['super_admin','admin','inventory_manager']::app_role[]);
  select jsonb_build_object(
    'active_products', (select count(*) from products where status = 'active'),
    'customers', (select count(*) from customers where status = 'active'),
    'stock_value', case when v_cost then (
        select coalesce(sum(ib.on_hand * pc.purchase_cost), 0) from inventory_balances ib join product_costs pc on pc.product_id = ib.product_id
      ) end,
    'stock_value_missing_cost', case when v_cost then (
        select count(distinct ib.product_id) from inventory_balances ib left join product_costs pc on pc.product_id = ib.product_id
        where ib.on_hand > 0 and pc.purchase_cost is null) end,
    'low_stock', (select count(*) from inventory_overview where status = 'active' and available <= reorder_threshold),
    'new_enquiries', (select count(*) from enquiries where status = 'new'),
    'quotations_awaiting', (select count(*) from quotations where status in ('sent','viewed')),
    'quotations_pending_approval', (select count(*) from quotations where status = 'pending_approval'),
    'confirmed_orders', (select count(*) from sales_orders where status in ('confirmed','stock_reserved')),
    'awaiting_dispatch', (select count(*) from sales_orders where status in ('stock_reserved','partially_fulfilled','ready_for_dispatch')),
    'invoices_pending', (select count(*) from invoices where sync_status in ('pending','failed')),
    'invoices_unpaid', (select count(*) from invoices where sync_status in ('created','mock') and coalesce(balance_due, total) > 0),
    'invoices_overdue', (select count(*) from invoices where sync_status in ('created','mock') and coalesce(balance_due, total) > 0 and due_date < current_date),
    'integration_failures', (select count(*) from integration_jobs where status = 'failed'),
    'pending_order_value', (select coalesce(sum(grand_total), 0) from sales_orders where status not in ('cancelled','completed','delivered','dispatched')),
    'quotation_pipeline', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from quotations group by status) x),
    'order_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from sales_orders group by status) x),
    'sales_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'total', t, 'orders', n) order by m), '[]') from (
        select to_char(date_trunc('month', order_date), 'YYYY-MM') m, sum(grand_total) t, count(*) n
        from sales_orders where status <> 'cancelled' and order_date >= date_trunc('month', current_date) - interval '5 months'
        group by 1) x)
  ) into r;
  return r;
end $$;

-- Generic sales report. p_dim: period | product | category | customer | salesperson
create or replace function report_sales(p_from date, p_to date, p_dim text)
returns table (label text, orders bigint, quantity numeric, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_dim = 'period' then
    return query select to_char(date_trunc('month', so.order_date), 'YYYY-MM'), count(*)::bigint, null::numeric, sum(so.grand_total)
      from sales_orders so where so.status <> 'cancelled' and so.order_date between p_from and p_to group by 1 order by 1;
  elsif p_dim = 'customer' then
    return query select c.company_name, count(*)::bigint, null::numeric, sum(so.grand_total)
      from sales_orders so join customers c on c.id = so.customer_id
      where so.status <> 'cancelled' and so.order_date between p_from and p_to group by 1 order by 4 desc;
  elsif p_dim = 'salesperson' then
    return query select coalesce(pr.full_name, 'Unassigned'), count(*)::bigint, null::numeric, sum(so.grand_total)
      from sales_orders so left join profiles pr on pr.id = so.salesperson_id
      where so.status <> 'cancelled' and so.order_date between p_from and p_to group by 1 order by 4 desc;
  elsif p_dim = 'product' then
    return query select soi.name_snapshot || ' (' || soi.sku_snapshot || ')', count(distinct so.id)::bigint, sum(soi.quantity), sum(soi.line_total)
      from sales_order_items soi join sales_orders so on so.id = soi.sales_order_id
      where so.status <> 'cancelled' and so.order_date between p_from and p_to group by 1 order by 4 desc;
  elsif p_dim = 'category' then
    return query select coalesce(c.name, 'Uncategorised'), count(distinct so.id)::bigint, sum(soi.quantity), sum(soi.line_total)
      from sales_order_items soi join sales_orders so on so.id = soi.sales_order_id
      left join products p on p.id = soi.product_id left join categories c on c.id = p.category_id
      where so.status <> 'cancelled' and so.order_date between p_from and p_to group by 1 order by 4 desc;
  else
    raise exception 'Unknown report dimension %', p_dim;
  end if;
end $$;

create or replace function report_quotations(p_from date, p_to date)
returns table (sent bigint, accepted bigint, rejected bigint, converted bigint, expired bigint, sent_value numeric, won_value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_any_role(array['super_admin','admin','sales_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  return query
  select count(*) filter (where q.sent_at is not null),
         count(*) filter (where q.status = 'accepted'),
         count(*) filter (where q.status = 'rejected'),
         count(*) filter (where q.status = 'converted'),
         count(*) filter (where q.status = 'expired'),
         coalesce(sum(q.grand_total) filter (where q.sent_at is not null), 0),
         coalesce(sum(q.grand_total) filter (where q.status in ('accepted','converted')), 0)
  from quotations q where q.quotation_date between p_from and p_to;
end $$;

create or replace function report_inventory_valuation()
returns table (sku text, name text, category text, on_hand numeric, unit_cost numeric, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_any_role(array['super_admin','admin','inventory_manager']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  return query
  select p.sku, p.name, c.name, coalesce(sum(ib.on_hand), 0), pc.purchase_cost, coalesce(sum(ib.on_hand), 0) * pc.purchase_cost
  from products p left join categories c on c.id = p.category_id
  left join inventory_balances ib on ib.product_id = p.id
  left join product_costs pc on pc.product_id = p.id
  where p.status <> 'archived'
  group by p.sku, p.name, c.name, pc.purchase_cost order by 6 desc nulls last;
end $$;
