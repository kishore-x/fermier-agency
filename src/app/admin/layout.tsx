import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { AdminSidebar, type NavKey } from "@/components/admin/sidebar";
import { signOut } from "@/app/(auth)/actions";
import { can, requireStaff, ROLE_LABEL, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function allowedNav(s: Session): NavKey[] {
  const keys: NavKey[] = ["overview", "products", "inventory", "customers", "enquiries", "quotations", "purchase-orders", "sales-orders", "dispatches", "invoices", "reports"];
  if (can.manageProducts(s)) keys.push("categories", "brands", "suppliers", "settings");
  if (can.manageIntegrations(s)) keys.push("integrations");
  if (can.manageUsers(s)) keys.push("users");
  if (can.viewAudit(s)) keys.push("audit-logs");
  if (s.roles.includes("inventory_manager")) keys.push("suppliers");
  return keys;
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireStaff();
  const supabase = await createClient();
  const [{ count: unread }, { count: newEnq }, { count: pendingApproval }, { count: posToVerify }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.userId).is("read_at", null),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    supabase.from("customer_purchase_orders").select("id", { count: "exact", head: true }).eq("status", "received"),
  ]);
  return (
    <div className="flex min-h-screen">
      <AdminSidebar allowed={allowedNav(session)} badges={{ enquiries: newEnq ?? 0, quotations: pendingApproval ?? 0, "purchase-orders": posToVerify ?? 0 }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b border-line bg-white px-4 pl-16 lg:pl-4">
          <Link href="/admin/notifications" className="relative rounded-md p-2 text-muted hover:bg-canvas hover:text-ink" aria-label={`Notifications, ${unread ?? 0} unread`}>
            <Bell className="h-5 w-5" />
            {!!unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand" />}
          </Link>
          <div className="hidden text-right text-sm sm:block">
            <p className="font-medium leading-tight">{session.fullName}</p>
            <p className="text-xs text-muted">{session.roles.map((r) => ROLE_LABEL[r]).join(", ")}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink" aria-label="Sign out" title="Sign out"><LogOut className="h-5 w-5" /></button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
