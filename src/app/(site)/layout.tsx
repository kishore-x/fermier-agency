import { MobileBottomNav, SiteFooter, SiteHeader } from "@/components/catalog/site-chrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh] bg-page">{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  );
}
