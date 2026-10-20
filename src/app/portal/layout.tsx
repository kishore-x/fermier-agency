import { LogOut } from "lucide-react";
import { MobileBottomNav, SiteFooter, SiteHeader } from "@/components/catalog/site-chrome";
import { PortalNav } from "@/components/portal/portal-nav";
import { signOut } from "@/app/(auth)/actions";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await requireCustomer();
  const supabase = await createClient();
  const [{ data: cust }, { count: unread }] = await Promise.all([
    supabase.from("customers").select("company_name, customer_code").eq("id", session.customerId).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.userId).is("read_at", null),
  ]);
  return (
    <>
      <SiteHeader />
      <div className="border-b border-line bg-white">
        <div className="container-site flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-semibold">{cust?.company_name}</p>
            <p className="text-xs text-muted">{session.fullName} · Account {cust?.customer_code}</p>
          </div>
          <form action={signOut}><button className="flex items-center gap-1 text-sm text-muted hover:text-ink"><LogOut className="h-4 w-4" />Sign out</button></form>
        </div>
        <PortalNav unread={unread ?? 0} />
      </div>
      <main className="container-site min-h-[60vh] py-6">{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  );
}
