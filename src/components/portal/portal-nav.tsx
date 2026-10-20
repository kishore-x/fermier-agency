"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/portal", "Overview"], ["/portal/catalog", "Catalog"], ["/portal/cart", "Cart"], ["/portal/enquiries", "Requests"],
  ["/portal/quotations", "Quotations"], ["/portal/purchase-orders", "Purchase orders"], ["/portal/orders", "Orders"],
  ["/portal/invoices", "Invoices"], ["/portal/profile", "Profile"],
] as const;

export function PortalNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav className="container-site flex gap-1 overflow-x-auto" aria-label="Customer portal">
      {ITEMS.map(([href, label]) => {
        const active = href === "/portal" ? path === "/portal" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>
            {label}{href === "/portal" && unread > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 text-[10px] text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
