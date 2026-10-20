-- Users may edit their own name/phone, but never their own discount limit or active flag.
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.discount_limit_pct is distinct from old.discount_limit_pct or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and auth.uid() is not null
     and not has_any_role(array['super_admin','admin']::app_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile_privileges();

-- Customers may update limited contact fields on their own company record.
create or replace function update_my_company(p_contact text, p_phone text, p_billing text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := my_customer_id();
begin
  if v is null then raise exception 'FORBIDDEN'; end if;
  update customers set primary_contact = left(p_contact, 120), phone = left(p_phone, 20), billing_address = left(p_billing, 500), state = left(p_state, 80)
  where id = v;
  insert into customer_activities(customer_id, activity_type, summary, created_by) values (v, 'account', 'Customer updated company contact details', auth.uid());
end $$;

-- Customers may see the name/email of their own assigned salesperson.
create policy profiles_my_salesperson on profiles for select to authenticated
  using (id = (select salesperson_id from customers where id = my_customer_id()));
