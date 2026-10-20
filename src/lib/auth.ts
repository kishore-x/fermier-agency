import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role =
  | "super_admin"
  | "admin"
  | "sales_manager"
  | "sales_executive"
  | "inventory_manager"
  | "customer";

export const STAFF_ROLES: Role[] = ["super_admin", "admin", "sales_manager", "sales_executive", "inventory_manager"];
export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_executive: "Sales Executive",
  inventory_manager: "Inventory Manager",
  customer: "Customer",
};

export type Session = {
  userId: string;
  email: string;
  fullName: string;
  roles: Role[];
  customerId: string | null;
  isStaff: boolean;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { data: roles }, { data: cu }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, is_active").eq("id", data.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    supabase.from("customer_users").select("customer_id").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if (profile && profile.is_active === false) return null;
  const r = (roles ?? []).map((x) => x.role as Role);
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    fullName: profile?.full_name || data.user.email || "",
    roles: r,
    customerId: cu?.customer_id ?? null,
    isStaff: r.some((x) => STAFF_ROLES.includes(x)),
  };
});

export function hasRole(s: Session | null, ...roles: Role[]) {
  return !!s && s.roles.some((r) => roles.includes(r));
}

/** Use in staff pages/actions. Redirects if not signed in or lacking role. */
export async function requireStaff(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.isStaff) redirect("/portal");
  if (roles.length && !hasRole(s, "super_admin", ...roles)) redirect("/admin?denied=1");
  return s;
}

export async function requireCustomer(): Promise<Session & { customerId: string }> {
  const s = await getSession();
  if (!s) redirect("/login?next=/portal");
  if (!s.customerId) redirect(s.isStaff ? "/admin" : "/login");
  return s as Session & { customerId: string };
}

export const can = {
  manageProducts: (s: Session) => hasRole(s, "super_admin", "admin"),
  viewCost: (s: Session) => hasRole(s, "super_admin", "admin", "inventory_manager"),
  manageInventory: (s: Session) => hasRole(s, "super_admin", "admin", "inventory_manager"),
  sell: (s: Session) => hasRole(s, "super_admin", "admin", "sales_manager", "sales_executive"),
  approve: (s: Session) => hasRole(s, "super_admin", "admin", "sales_manager"),
  confirmOrders: (s: Session) => hasRole(s, "super_admin", "admin", "sales_manager"),
  dispatch: (s: Session) => hasRole(s, "super_admin", "admin", "inventory_manager"),
  manageIntegrations: (s: Session) => hasRole(s, "super_admin", "admin"),
  manageUsers: (s: Session) => hasRole(s, "super_admin"),
  viewAudit: (s: Session) => hasRole(s, "super_admin"),
  financialReports: (s: Session) => hasRole(s, "super_admin", "admin", "sales_manager"),
};
