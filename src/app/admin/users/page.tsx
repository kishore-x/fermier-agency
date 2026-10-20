import { ActionForm, ConfirmAction, SubmitButton } from "@/components/ui/forms";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff, ROLE_LABEL, STAFF_ROLES, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createStaffUser, setUserRole, updateStaffProfile } from "../system-actions";

const PERMS: Record<Role, string> = {
  super_admin: "Everything, incl. users, integrations, audit logs",
  admin: "Products, inventory, customers, sales, settings",
  sales_manager: "Pipeline, approvals, PO verification, order confirmation",
  sales_executive: "Assigned customers, enquiries, quotations",
  inventory_manager: "Stock movements, reservations, dispatch, costs",
  customer: "Own portal only",
};

export default async function UsersPage() {
  const session = await requireStaff("super_admin");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email, is_active, discount_limit_pct, created_at, user_roles(role)").order("full_name");
  const staff = (data ?? []).filter((p) => (p.user_roles as { role: Role }[]).some((r) => r.role !== "customer"));
  return (
    <>
      <PageHeader title="Users & roles" description="Permissions are enforced in the database and on the server, not just hidden in the UI." />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <ul className="divide-y divide-line">
            {staff.map((u) => {
              const roles = (u.user_roles as { role: Role }[]).map((r) => r.role);
              return (
                <li key={u.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{u.full_name || u.email}</p><span className="text-sm text-muted">{u.email}</span>
                    {!u.is_active && <StatusBadge status="inactive" label="Deactivated" />}
                    {u.id === session.userId && <StatusBadge status="new" label="You" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAFF_ROLES.map((r) => {
                      const has = roles.includes(r);
                      return (
                        <ConfirmAction key={r} action={setUserRole} fields={{ user_id: u.id, role: r, on: String(!has) }}
                          trigger={<span className={has ? "text-brand-600" : "text-muted"}>{has ? "✓ " : "+ "}{ROLE_LABEL[r]}</span>} triggerVariant={has ? "outline" : "ghost"}
                          title={`${has ? "Remove" : "Grant"} ${ROLE_LABEL[r]}?`} description={PERMS[r]} confirmLabel={has ? "Remove role" : "Grant role"} tone={has ? "danger" : "primary"} />
                      );
                    })}
                  </div>
                  <ActionForm action={updateStaffProfile} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="user_id" value={u.id} />
                    <label className="flex items-center gap-1">Discount limit %<Input name="discount_limit_pct" defaultValue={String(Number(u.discount_limit_pct))} className="h-8 w-20" inputMode="decimal" /></label>
                    <input type="hidden" name="is_active" value={String(u.is_active)} />
                    <SubmitButton size="sm" variant="outline">Save</SubmitButton>
                  </ActionForm>
                  {u.id !== session.userId && (
                    <ConfirmAction action={updateStaffProfile} fields={{ user_id: u.id, is_active: String(!u.is_active), discount_limit_pct: String(Number(u.discount_limit_pct)) }}
                      trigger={u.is_active ? "Deactivate user" : "Reactivate user"} triggerVariant="ghost" tone={u.is_active ? "danger" : "success"}
                      title={u.is_active ? "Deactivate this user?" : "Reactivate this user?"} description={u.is_active ? "Blocks sign-in. History is preserved." : undefined} confirmLabel="Confirm" />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Add staff user" />
            <ActionForm action={createStaffUser} resetOnSuccess className="space-y-3 p-4">
              <Field label="Full name" name="full_name"><Input id="full_name" name="full_name" required /></Field>
              <Field label="Email" name="email"><Input id="email" name="email" type="email" required /></Field>
              <Field label="Temporary password" name="password" hint="Min 10 characters; share securely"><Input id="password" name="password" minLength={10} required autoComplete="off" /></Field>
              <Field label="Discount limit %" name="discount_limit_pct" hint="Quotations above this (or the company threshold) need approval"><Input id="discount_limit_pct" name="discount_limit_pct" defaultValue="0" inputMode="decimal" /></Field>
              <fieldset className="space-y-1 text-sm"><legend className="mb-1 font-medium">Roles</legend>
                {STAFF_ROLES.map((r) => <label key={r} className="flex items-center gap-2"><input type="checkbox" name="roles" value={r} />{ROLE_LABEL[r]}</label>)}
              </fieldset>
              <SubmitButton className="w-full">Create user</SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader title="Role reference" />
            <dl className="space-y-2 p-4 text-sm">{(Object.keys(PERMS) as Role[]).map((r) => <div key={r}><dt className="font-medium">{ROLE_LABEL[r]}</dt><dd className="text-muted">{PERMS[r]}</dd></div>)}</dl>
          </Card>
        </div>
      </div>
    </>
  );
}
