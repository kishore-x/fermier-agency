-- Sales executives can read all customers but only modify those assigned to them.
drop policy if exists cust_staff on customers;
create policy cust_staff_read on customers for select to authenticated using (is_staff());
create policy cust_mgr_write on customers for all to authenticated
  using (has_any_role(array['super_admin','admin','sales_manager']::app_role[]))
  with check (has_any_role(array['super_admin','admin','sales_manager']::app_role[]));
create policy cust_exec_insert on customers for insert to authenticated
  with check (has_role('sales_executive') and salesperson_id = auth.uid());
create policy cust_exec_update on customers for update to authenticated
  using (has_role('sales_executive') and salesperson_id = auth.uid())
  with check (has_role('sales_executive') and salesperson_id = auth.uid());

drop policy if exists caddr_staff on customer_addresses;
create policy caddr_staff_read on customer_addresses for select to authenticated using (is_staff());
create policy caddr_staff_write on customer_addresses for all to authenticated
  using (has_any_role(array['super_admin','admin','sales_manager']::app_role[])
         or exists (select 1 from customers c where c.id = customer_id and c.salesperson_id = auth.uid()))
  with check (has_any_role(array['super_admin','admin','sales_manager']::app_role[])
         or exists (select 1 from customers c where c.id = customer_id and c.salesperson_id = auth.uid()));

-- Activity log is append-only for staff.
drop policy if exists cact_staff on customer_activities;
create policy cact_read on customer_activities for select to authenticated using (is_staff());
create policy cact_insert on customer_activities for insert to authenticated with check (is_staff() and created_by = auth.uid());
