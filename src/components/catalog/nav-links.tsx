"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLinks({ categories }: { categories: { name: string; slug: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const cls = (href: string) => cn("relative flex h-[60px] items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-900 hover:text-brand",
    active(href) && "text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand");
  return (
    <nav className="mx-auto hidden items-center gap-5 lg:flex xl:gap-6" aria-label="Main">
      <Link href="/" className={cls("/")}>Home</Link>
      <Dropdown label="Products" href="/catalog" cls={cls("/catalog")} items={[
        { href: "/catalog", label: "All products" }, { href: "/catalog?sort=featured", label: "Featured machinery" },
        { href: "/catalog?availability=in_stock", label: "In stock" }, { href: "/catalog?sort=newest", label: "New arrivals" },
      ]} />
      <Dropdown label="Categories" href="/categories" cls={cls("/categories")} wide items={categories.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name }))} />
      <Link href="/brands" className={cls("/brands")}>Brands</Link>
      <Link href="/services" className={cls("/services")}>Services</Link>
      <Link href="/about" className={cls("/about")}>About</Link>
      <Link href="/contact" className={cls("/contact")}>Contact</Link>
    </nav>
  );
}

function Dropdown({ label, href, items, cls, wide }: { label: string; href: string; items: { href: string; label: string }[]; cls: string; wide?: boolean }) {
  return (
    <div className="group relative">
      <Link href={href} className={cls}>{label}<ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" /></Link>
      <div className={cn("invisible absolute left-1/2 top-full z-50 -translate-x-1/2 rounded-md border border-line bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100", wide ? "grid w-[520px] grid-cols-2" : "w-56")}>
        {items.map((i) => <Link key={i.href} href={i.href} className="block rounded px-3 py-2 text-[13px] text-ink-900 hover:bg-band hover:text-brand">{i.label}</Link>)}
      </div>
    </div>
  );
}
