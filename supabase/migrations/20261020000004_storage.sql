insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('product-documents', 'product-documents', true, 15728640, array['application/pdf']),
  ('customer-documents', 'customer-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "staff manage product images" on storage.objects for all to authenticated
  using (bucket_id in ('product-images','product-documents') and has_any_role(array['super_admin','admin']::app_role[]))
  with check (bucket_id in ('product-images','product-documents') and has_any_role(array['super_admin','admin']::app_role[]));

-- customer-documents layout: {customer_id}/{kind}/{uuid}-{filename}
create policy "staff read customer docs" on storage.objects for select to authenticated
  using (bucket_id = 'customer-documents' and is_staff());
create policy "staff upload customer docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-documents' and is_staff());
create policy "customer read own docs" on storage.objects for select to authenticated
  using (bucket_id = 'customer-documents' and (storage.foldername(name))[1] = my_customer_id()::text);
create policy "customer upload own docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-documents' and (storage.foldername(name))[1] = my_customer_id()::text);
-- No update/delete policies: uploaded originals are immutable for everyone except the service role.
