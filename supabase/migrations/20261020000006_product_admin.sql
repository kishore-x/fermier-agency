-- Atomic product save: product row + cost + specifications in one transaction.
-- p: product fields; p_specs: [{spec_group,label,value}] (replaces existing); p_cost: null leaves cost unchanged unless p_set_cost.
create or replace function save_product(p_id uuid, p jsonb, p_specs jsonb, p_cost numeric, p_set_cost boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; s jsonb; i int := 0;
begin
  if not has_any_role(array['super_admin','admin']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_id is null then
    insert into products (sku, slug, name, brand_id, manufacturer, category_id, subcategory_id, model_number, short_description,
      description, unit, selling_price, tax_rate, hsn_code, price_visibility, reorder_threshold, is_featured, status, created_by)
    values (upper(trim(p->>'sku')), p->>'slug', trim(p->>'name'), nullif(p->>'brand_id','')::uuid, nullif(p->>'manufacturer',''),
      nullif(p->>'category_id','')::uuid, nullif(p->>'subcategory_id','')::uuid, nullif(p->>'model_number',''),
      nullif(p->>'short_description',''), nullif(p->>'description',''), coalesce(nullif(p->>'unit',''),'Nos'),
      nullif(p->>'selling_price','')::numeric, coalesce(nullif(p->>'tax_rate','')::numeric, 18), nullif(p->>'hsn_code',''),
      coalesce(nullif(p->>'price_visibility',''),'show_price')::price_visibility, coalesce(nullif(p->>'reorder_threshold','')::numeric, 0),
      coalesce((p->>'is_featured')::boolean, false), coalesce(nullif(p->>'status',''),'draft')::product_status, auth.uid())
    returning id into v_id;
    insert into inventory_balances(product_id, warehouse_id) values (v_id, default_warehouse()) on conflict do nothing;
    perform write_audit('product.created', 'product', v_id::text, null, p);
  else
    update products set sku = upper(trim(p->>'sku')), slug = p->>'slug', name = trim(p->>'name'),
      brand_id = nullif(p->>'brand_id','')::uuid, manufacturer = nullif(p->>'manufacturer',''),
      category_id = nullif(p->>'category_id','')::uuid, subcategory_id = nullif(p->>'subcategory_id','')::uuid,
      model_number = nullif(p->>'model_number',''), short_description = nullif(p->>'short_description',''),
      description = nullif(p->>'description',''), unit = coalesce(nullif(p->>'unit',''),'Nos'),
      selling_price = nullif(p->>'selling_price','')::numeric, tax_rate = coalesce(nullif(p->>'tax_rate','')::numeric, 18),
      hsn_code = nullif(p->>'hsn_code',''), price_visibility = coalesce(nullif(p->>'price_visibility',''),'show_price')::price_visibility,
      reorder_threshold = coalesce(nullif(p->>'reorder_threshold','')::numeric, 0), is_featured = coalesce((p->>'is_featured')::boolean, false),
      status = coalesce(nullif(p->>'status',''),'draft')::product_status
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Product not found'; end if;
  end if;
  if (p->>'status') = 'active' and (p->>'price_visibility') = 'show_price' and nullif(p->>'selling_price','') is null then
    raise exception 'Active products shown with a price need a selling price (or set price visibility to "on request")';
  end if;

  if p_set_cost then
    insert into product_costs(product_id, purchase_cost) values (v_id, p_cost)
    on conflict (product_id) do update set purchase_cost = excluded.purchase_cost, updated_at = now();
  end if;

  if p_specs is not null then
    delete from product_specifications where product_id = v_id;
    for s in select * from jsonb_array_elements(p_specs) loop
      continue when coalesce(trim(s->>'label'),'') = '' or coalesce(trim(s->>'value'),'') = '';
      i := i + 1;
      insert into product_specifications(product_id, spec_group, label, value, sort_order)
      values (v_id, coalesce(nullif(trim(s->>'spec_group'),''),'General'), trim(s->>'label'), trim(s->>'value'), i);
    end loop;
  end if;
  return v_id;
end $$;

-- All-or-nothing CSV import. Rows pre-validated in the app; anything failing here aborts the whole batch.
-- Row: {sku,name,category_slug,brand_name,model_number,unit,selling_price,purchase_cost,tax_rate,hsn_code,
--       price_visibility,reorder_threshold,status,short_description,description,opening_stock}
create or replace function import_products(p_rows jsonb, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_cat uuid; v_brand uuid; v_id uuid; v_exists uuid; created int := 0; updated int := 0; n int := 0; v_slug text;
begin
  if not has_any_role(array['super_admin','admin']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('create_only','upsert') then raise exception 'Invalid import mode'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    select id into v_cat from categories where slug = r->>'category_slug';
    if v_cat is null then raise exception 'Row %: unknown category "%"', n, r->>'category_slug'; end if;
    v_brand := null;
    if coalesce(r->>'brand_name','') <> '' then
      select id into v_brand from brands where lower(name) = lower(r->>'brand_name');
      if v_brand is null then
        insert into brands(name, slug) values (r->>'brand_name', regexp_replace(lower(r->>'brand_name'), '[^a-z0-9]+', '-', 'g'))
        returning id into v_brand;
      end if;
    end if;
    select id into v_exists from products where sku = upper(r->>'sku');
    if v_exists is not null and p_mode = 'create_only' then raise exception 'Row %: SKU % already exists', n, r->>'sku'; end if;
    v_slug := regexp_replace(lower(r->>'name' || '-' || (r->>'sku')), '[^a-z0-9]+', '-', 'g');

    if v_exists is null then
      insert into products(sku, slug, name, category_id, brand_id, model_number, unit, selling_price, tax_rate, hsn_code,
        price_visibility, reorder_threshold, status, short_description, description, created_by)
      values (upper(r->>'sku'), v_slug, r->>'name', v_cat, v_brand, nullif(r->>'model_number',''), coalesce(nullif(r->>'unit',''),'Nos'),
        nullif(r->>'selling_price','')::numeric, coalesce(nullif(r->>'tax_rate','')::numeric, 18), nullif(r->>'hsn_code',''),
        coalesce(nullif(r->>'price_visibility',''),'show_price')::price_visibility, coalesce(nullif(r->>'reorder_threshold','')::numeric,0),
        coalesce(nullif(r->>'status',''),'draft')::product_status, nullif(r->>'short_description',''), nullif(r->>'description',''), auth.uid())
      returning id into v_id;
      created := created + 1;
      insert into inventory_balances(product_id, warehouse_id) values (v_id, default_warehouse()) on conflict do nothing;
      if coalesce(nullif(r->>'opening_stock','')::numeric, 0) > 0 then
        perform apply_inventory_movement(v_id, default_warehouse(), 'goods_received', (r->>'opening_stock')::numeric, 0,
          'import', null, 'CSV-IMPORT', 'Opening stock from CSV import', auth.uid());
      end if;
    else
      update products set name = r->>'name', category_id = v_cat, brand_id = v_brand, model_number = nullif(r->>'model_number',''),
        unit = coalesce(nullif(r->>'unit',''),'Nos'), selling_price = nullif(r->>'selling_price','')::numeric,
        tax_rate = coalesce(nullif(r->>'tax_rate','')::numeric, 18), hsn_code = nullif(r->>'hsn_code',''),
        price_visibility = coalesce(nullif(r->>'price_visibility',''),'show_price')::price_visibility,
        reorder_threshold = coalesce(nullif(r->>'reorder_threshold','')::numeric,0), status = coalesce(nullif(r->>'status',''),'draft')::product_status,
        short_description = nullif(r->>'short_description',''), description = nullif(r->>'description','')
      where id = v_exists;
      v_id := v_exists;
      updated := updated + 1;
    end if;
    if coalesce(r->>'purchase_cost','') <> '' then
      insert into product_costs(product_id, purchase_cost) values (v_id, (r->>'purchase_cost')::numeric)
      on conflict (product_id) do update set purchase_cost = excluded.purchase_cost, updated_at = now();
    end if;
  end loop;
  perform write_audit('product.csv_import', 'product', null, null, jsonb_build_object('created', created, 'updated', updated));
  return jsonb_build_object('created', created, 'updated', updated);
end $$;

create or replace function duplicate_product(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare src products; v_id uuid; v_sku text;
begin
  if not has_any_role(array['super_admin','admin']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into src from products where id = p_id;
  if src.id is null then raise exception 'Product not found'; end if;
  v_sku := src.sku || '-COPY';
  while exists (select 1 from products where sku = v_sku) loop v_sku := v_sku || 'X'; end loop;
  insert into products (sku, slug, name, brand_id, manufacturer, category_id, subcategory_id, model_number, short_description, description,
    unit, selling_price, tax_rate, hsn_code, price_visibility, reorder_threshold, is_featured, status, created_by)
  values (v_sku, lower(v_sku) || '-' || substr(md5(random()::text), 1, 4), src.name || ' (copy)', src.brand_id, src.manufacturer,
    src.category_id, src.subcategory_id, src.model_number, src.short_description, src.description, src.unit, src.selling_price,
    src.tax_rate, src.hsn_code, src.price_visibility, src.reorder_threshold, false, 'draft', auth.uid())
  returning id into v_id;
  insert into product_specifications(product_id, spec_group, label, value, sort_order)
  select v_id, spec_group, label, value, sort_order from product_specifications where product_id = p_id;
  insert into product_costs(product_id, purchase_cost) select v_id, purchase_cost from product_costs where product_id = p_id;
  insert into inventory_balances(product_id, warehouse_id) values (v_id, default_warehouse());
  return v_id;
end $$;
