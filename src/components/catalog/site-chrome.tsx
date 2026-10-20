import Link from "next/link";
import { BookOpenText, ChevronDown, Grid2x2, Headset, Home, Search, User } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth";
import { getCompany, whatsappLink } from "@/lib/queries/catalog";
import { CartLink } from "./cart-link";

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Fermier Agency home">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-xl font-bold text-white">F</span>
      <span className={light ? "text-white" : "text-navy"}>
        <span className="block text-[22px] font-extrabold leading-none tracking-tight">FERMIER</span>
        <span className="mt-0.5 block text-[11px] font-medium uppercase leading-tight tracking-[0.32em] opacity-80">Agency</span>
      </span>
    </Link>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}

export async function SiteHeader({ defaultQuery }: { defaultQuery?: string }) {
  const [session, company] = await Promise.all([getSession(), getCompany()]);
  const wa = whatsappLink(company?.whatsapp_number, "Hello Fermier Agency, I have a product enquiry.");
  const home = session ? (session.isStaff ? "/admin" : "/portal") : null;
  const navLink = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white";
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-navy text-white">
      <div className="mx-auto grid h-[60px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
        <nav className="flex items-center gap-1 lg:gap-4">
          <a href={wa ?? "/contact"} target={wa ? "_blank" : undefined} rel="noopener noreferrer" className={navLink} aria-label="Chat on WhatsApp">
            <WhatsAppIcon className="h-6 w-6 text-[#25D366]" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
          <Link href="/catalog" className={`${navLink} hidden lg:flex`}><BookOpenText className="h-5 w-5" strokeWidth={1.75} />Catalog</Link>
          <Link href="/contact" className={`${navLink} hidden lg:flex`}><Headset className="h-5 w-5" strokeWidth={1.75} />Contact</Link>
        </nav>
        <Logo />
        <div className="flex items-center justify-end gap-2 lg:gap-4">
          <form action="/catalog" className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model..."
              className="h-10 w-60 rounded-lg bg-white pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand lg:w-[295px]" />
          </form>
          <CartLink className="hidden md:flex" />
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <User className="h-5 w-5" strokeWidth={1.75} /> <span className="hidden sm:inline">Account</span>
              <ChevronDown className="hidden h-4 w-4 transition-transform group-open:rotate-180 sm:block" />
            </summary>
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-xl">
              {session ? (
                <>
                  <p className="border-b border-line px-4 py-2 text-xs text-muted">Signed in as<span className="block truncate font-medium text-ink">{session.fullName}</span></p>
                  <Link href={home!} className="block px-4 py-2 hover:bg-canvas">{session.isStaff ? "Operations dashboard" : "My account"}</Link>
                  {!session.isStaff && <Link href="/portal/orders" className="block px-4 py-2 hover:bg-canvas">My orders</Link>}
                  <form action={signOut}><button className="block w-full px-4 py-2 text-left text-danger hover:bg-canvas">Sign out</button></form>
                </>
              ) : (
                <>
                  <Link href="/login" className="block px-4 py-2 font-medium hover:bg-canvas">Sign in</Link>
                  <Link href="/register" className="block px-4 py-2 hover:bg-canvas">Open a trade account</Link>
                  <Link href="/portal/orders" className="block px-4 py-2 hover:bg-canvas">Track an order</Link>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
      <form action="/catalog" className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
          <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model..."
            className="h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none" />
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
