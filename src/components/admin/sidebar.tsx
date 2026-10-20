"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Boxes, Building2, ClipboardList, FileCheck2, FileText, FolderTree, LayoutDashboard, Menu, PackageSearch,
  PanelLeftClose, PanelLeftOpen, Plug, Receipt, ScrollText, Settings, ShieldCheck, ShoppingBag, Tag, Truck, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavKey =
  | "overview" | "products" | "categories" | "brands" | "inventory" | "customers" | "suppliers" | "enquiries" | "quotations"
  | "purchase-orders" | "sales-orders" | "dispatches" | "invoices" | "reports" | "integrations" | "users" | "settings" | "audit-logs";

const NAV: { group: string; items: { key: NavKey; label: string; href: string; icon: typeof Boxes }[] }[] = [
  { group: "", items: [{ key: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard }] },
  { group: "Catalog", items: [
    { key: "products", label: "Products", href: "/admin/products", icon: PackageSearch },
    { key: "categories", label: "Categories", href: "/admin/categories", icon: FolderTree },
    { key: "brands", label: "Brands", href: "/admin/brands", icon: Tag },
    { key: "inventory", label: "Inventory", href: "/admin/inventory", icon: Boxes },
  ] },
  { group: "Sales", items: [
    { key: "enquiries", label: "Enquiries", href: "/admin/enquiries", icon: ClipboardList },
    { key: "quotations", label: "Quotations", href: "/admin/quotations", icon: FileText },
    { key: "purchase-orders", label: "Customer POs", href: "/admin/purchase-orders", icon: FileCheck2 },
    { key: "sales-orders", label: "Sales Orders", href: "/admin/sales-orders", icon: ShoppingBag },
    { key: "dispatches", label: "Dispatches", href: "/admin/dispatches", icon: Truck },
    { key: "invoices", label: "Invoices", href: "/admin/invoices", icon: Receipt },
  ] },
  { group: "Masters", items: [
    { key: "customers", label: "Customers", href: "/admin/customers", icon: Building2 },
    { key: "suppliers", label: "Suppliers", href: "/admin/suppliers", icon: Building2 },
  ] },
  { group: "Insights", items: [{ key: "reports", label: "Reports", href: "/admin/reports", icon: BarChart3 }] },
  { group: "System", items: [
    { key: "integrations", label: "Integrations", href: "/admin/integrations", icon: Plug },
    { key: "users", label: "Users & Roles", href: "/admin/users", icon: Users },
    { key: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
    { key: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  ] },
];

export function AdminSidebar({ allowed, badges }: { allowed: NavKey[]; badges: Partial<Record<NavKey, number>> }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("fermier.sidebar") === "1");
    } catch { /* ignore */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [path]);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("fermier.sidebar", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((g) => {
        const items = g.items.filter((i) => allowed.includes(i.key));
        if (!items.length) return null;
        return (
          <div key={g.group || "root"} className="mb-3">
            {g.group && !collapsed && <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">{g.group}</p>}
            {items.map((i) => (
              <Link key={i.key} href={i.href} title={collapsed ? i.label : undefined}
                className={cn("relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white",
                  isActive(i.href) && "bg-white/[0.14] font-medium text-white before:absolute before:-left-2 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-[#3a95f7]",
                  collapsed && "justify-center")}>
                <i.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1">{i.label}</span>}
                {!collapsed && !!badges[i.key] && (
                  <span className="rounded-full bg-[#3a95f7] px-1.5 text-[10px] font-semibold leading-4 text-white tnum">{badges[i.key]}</span>
                )}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <button className="fixed left-3 top-3 z-50 rounded-md bg-[#1b6196] p-2 text-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col bg-[linear-gradient(180deg,#123f66_0%,#0f3557_45%,#0b2945_100%)] transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        collapsed ? "lg:w-16" : "lg:w-60", mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full")}>
        <div className={cn("flex h-14 items-center border-b border-white/10 bg-white px-3", collapsed ? "justify-center" : "justify-between")}>
          <Link href="/admin" className="flex items-center gap-2" aria-label="Fermier Agency operations home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={collapsed ? "/site/logo-mark.png" : "/site/logo-hd.png"} alt="Fermier Agency" className={collapsed ? "h-6 w-auto" : "h-7 w-auto"} />
          </Link>
          {!collapsed && (
            <button onClick={toggle} className="hidden rounded p-1 text-[#1b6196]/60 hover:bg-[#e8f0f7] hover:text-[#1b6196] lg:block" aria-label="Collapse sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setMobileOpen(false)} className="rounded p-1 text-[#1b6196]/60 lg:hidden" aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>
        {collapsed && (
          <button onClick={toggle} className="mx-auto mt-2 hidden rounded p-1 text-white/60 hover:bg-white/10 hover:text-white lg:block" aria-label="Expand sidebar">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        {nav}
        <Link href="/" className={cn("flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-white/50 hover:text-white", collapsed && "justify-center px-0")}>
          <ShieldCheck className="h-4 w-4" />{!collapsed && "View public website"}
        </Link>
      </aside>
    </>
  );
}
