-- Visitors can't read `products` directly (it's staff-only), so child-table policies that subquery it
-- always failed for anonymous users. Check publication status through a security-definer helper instead.
create or replace function is_product_public(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from products where id = p_id and status = 'active')
$$;

drop policy if exists pimg_public on product_images;
create policy pimg_public on product_images for select using (is_product_public(product_id) or is_staff());
drop policy if exists pspec_public on product_specifications;
create policy pspec_public on product_specifications for select using (is_product_public(product_id) or is_staff());
drop policy if exists pdoc_public on product_documents;
create policy pdoc_public on product_documents for select using (is_product_public(product_id) or is_staff());
drop policy if exists pvar_public on product_variants;
create policy pvar_public on product_variants for select using (is_product_public(product_id) or is_staff());
