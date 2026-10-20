alter table products add column featured_rank int not null default 100;

create or replace view catalog_products with (security_invoker = false) as
select p.id, p.sku, p.slug, p.name, p.model_number, p.manufacturer, p.short_description, p.description,
       p.unit, p.tax_rate, p.is_featured, p.created_at, p.updated_at, p.is_sample_data,
       case when p.price_visibility = 'show_price' then p.selling_price end as display_price,
       p.price_visibility,
       c.id as category_id, c.name as category_name, c.slug as category_slug,
       b.id as brand_id, b.name as brand_name, b.slug as brand_slug,
       coalesce(sum(ib.on_hand - ib.reserved), 0) as available_qty,
       (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url,
       p.featured_rank
from products p
left join categories c on c.id = p.category_id
left join brands b on b.id = p.brand_id
left join inventory_balances ib on ib.product_id = p.id
where p.status = 'active'
group by p.id, c.id, b.id;
