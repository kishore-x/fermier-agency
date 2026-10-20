import Link from "next/link";
import { Grid2x2, Home, MessageCircle, Phone, Search, User } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getCompany, whatsappLink } from "@/lib/queries/catalog";
import { CartLink } from "./cart-link";

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Fermier Agency home">
      <span className="flex h-8 w-8 items-center justify-center rounded bg-brand text-sm font-bold text-white">F</span>
      <span className={light ? "text-white" : "text-navy"}>
        <span className="block text-base font-bold leading-none tracking-tight">FERMIER</span>
        <span className="block text-[10px] font-medium uppercase leading-tight tracking-[0.2em] opacity-75">Agency</span>
      </span>
    </Link>
  );
}

export async function SiteHeader({ defaultQuery }: { defaultQuery?: string }) {
  const [session, company] = await Promise.all([getSession(), getCompany()]);
  const wa = whatsappLink(company?.whatsapp_number, "Hello Fermier Agency, I have a product enquiry.");
  const accountHref = session ? (session.isStaff ? "/admin" : "/portal") : "/login";
  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="flex items-center gap-1">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-white/10" aria-label="Chat on WhatsApp">
              <MessageCircle className="h-5 w-5 text-brand" /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
          ) : (
            <Link href="/contact" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-white/10"><Phone className="h-5 w-5" /><span className="hidden sm:inline">Contact</span></Link>
          )}
          <nav className="ml-4 hidden items-center gap-1 text-sm lg:flex">
            <Link href="/catalog" className="rounded-md px-2 py-1.5 hover:bg-white/10">Catalog</Link>
            <Link href="/contact" className="rounded-md px-2 py-1.5 hover:bg-white/10">Contact</Link>
          </nav>
        </div>
        <Logo />
        <div className="flex items-center justify-end gap-1">
          <form action="/catalog" className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/60" />
            <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model"
              className="h-9 w-56 rounded-md border border-white/15 bg-white/10 pl-8 pr-2 text-sm text-white placeholder:text-white/60 focus:bg-white focus:text-ink focus:outline-none lg:w-72" />
          </form>
          <CartLink className="hidden md:flex" />
          <Link href={accountHref} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-white/10">
            <User className="h-5 w-5" /> <span className="hidden sm:inline">{session ? "Account" : "Sign in"}</span>
          </Link>
        </div>
      </div>
      <form action="/catalog" className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
          <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model"
            className="h-10 w-full rounded-md bg-white pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none" />
        </div>
      </form>
    </header>
  );
}

export function MobileBottomNav() {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted hover:text-navy";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
      <Link href="/" className={item}><Home className="h-5 w-5" />Home</Link>
      <Link href="/catalog" className={item}><Grid2x2 className="h-5 w-5" />Catalog</Link>
      <Link href="/catalog?focus=search" className={item}><Search className="h-5 w-5" />Search</Link>
      <CartLink variant="tab" />
      <Link href="/portal" className={item}><User className="h-5 w-5" />Account</Link>
    </nav>
  );
}

export async function SiteFooter() {
  const company = await getCompany();
  return (
    <footer className="mt-16 bg-navy pb-20 text-white/80 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm">Construction, lifting, power and agricultural equipment for contractors, dealers and workshops.</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Catalog</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/catalog/lifting-equipment" className="hover:text-white">Lifting Equipment</Link></li>
            <li><Link href="/catalog/generators" className="hover:text-white">Generators</Link></li>
            <li><Link href="/catalog/pressure-washers" className="hover:text-white">Pressure Washers</Link></li>
            <li><Link href="/catalog" className="hover:text-white">All products</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Customers</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/login" className="hover:text-white">Customer sign in</Link></li>
            <li><Link href="/register" className="hover:text-white">Open a trade account</Link></li>
            <li><Link href="/portal/orders" className="hover:text-white">Track orders</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {company?.address && <li>{company.address}</li>}
            {company?.phone && <li>{company.phone}</li>}
            {company?.email && <li>{company.email}</li>}
            <li><Link href="/contact" className="hover:text-white">Send an enquiry →</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {company?.company_name ?? "Fermier Agency"}. Demo environment — prices and stock shown are sample data.
      </div>
    </footer>
  );
}
