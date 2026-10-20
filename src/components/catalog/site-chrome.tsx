import Link from "next/link";
import { ArrowRight, Grid2x2, Home, Mail, MapPin, Menu, Phone, Search, User } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth";
import { getCategories, getCompany, whatsappLink } from "@/lib/queries/catalog";
import { SITE } from "@/lib/site-content";
import { CartLink } from "./cart-link";
import { NavLinks } from "./nav-links";

export function Logo({ footer = false, className }: { footer?: boolean; className?: string }) {
  return (
    <Link href="/" className={className ?? "shrink-0"} aria-label="Fermier Agency home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={footer ? "/site/logo-footer.png" : "/site/logo.png"} alt="Fermier Agency" className="h-[30px] w-auto" />
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
  const [session, company, categories] = await Promise.all([getSession(), getCompany(), getCategories()]);
  const home = session ? (session.isStaff ? "/admin" : "/portal") : "/login";
  const cats = categories.map((c) => ({ name: c.name, slug: c.slug }));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/95 backdrop-blur">
      <div className="container-site flex h-[60px] items-center gap-4">
        <Logo />
        <NavLinks categories={cats} />
        <div className="ml-auto flex items-center gap-3">
          <form action="/catalog" className="relative hidden xl:block">
            <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model..."
              className="h-9 w-[190px] rounded bg-[#e2ecf4] pl-3 pr-8 text-xs text-ink placeholder:text-[#5b6b7c] focus:outline-none focus:ring-2 focus:ring-brand/40" />
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand" />
          </form>
          <Link href="/contact" className="hidden h-9 items-center gap-2 whitespace-nowrap rounded bg-brand px-3.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-brand-600 sm:flex">
            Get enquiry <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {company?.phone && (
            <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className="hidden items-center gap-2 min-[1360px]:flex">
              <Phone className="h-[18px] w-[18px] text-[#5b6b7c]" strokeWidth={1.75} />
              <span className="whitespace-nowrap leading-tight"><span className="block text-[11px] font-semibold text-ink-900">{company.phone}</span><span className="block text-[10px] text-muted">{SITE.hours}</span></span>
            </a>
          )}
          <CartLink className="flex" variant="light" />
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center rounded p-1.5 text-ink-900 hover:bg-band [&::-webkit-details-marker]:hidden" aria-label="Account">
              <User className="h-5 w-5" strokeWidth={1.75} />
            </summary>
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-xl">
              {session ? (
                <>
                  <p className="border-b border-line px-4 py-2 text-xs text-muted">Signed in as<span className="block truncate font-medium text-ink">{session.fullName}</span></p>
                  <Link href={home} className="block px-4 py-2 hover:bg-canvas">{session.isStaff ? "Operations dashboard" : "My account"}</Link>
                  {!session.isStaff && <Link href="/portal/orders" className="block px-4 py-2 hover:bg-canvas">My orders</Link>}
                  <form action={signOut}><button className="block w-full px-4 py-2 text-left text-danger hover:bg-canvas">Sign out</button></form>
                </>
              ) : (
                <>
                  <Link href="/login" className="block px-4 py-2 font-medium hover:bg-canvas">Sign in</Link>
                  <Link href="/register" className="block px-4 py-2 hover:bg-canvas">Open a trade account</Link>
                </>
              )}
            </div>
          </details>
          <details className="group relative lg:hidden">
            <summary className="flex cursor-pointer list-none rounded p-1.5 text-ink-900 hover:bg-band [&::-webkit-details-marker]:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></summary>
            <nav className="absolute right-0 mt-2 w-60 rounded-lg border border-line bg-white py-1 text-sm shadow-xl">
              {[["/", "Home"], ["/catalog", "Products"], ["/categories", "Categories"], ["/brands", "Brands"], ["/services", "Services"], ["/about", "About"], ["/contact", "Contact"]].map(([h, l]) => (
                <Link key={h} href={h} className="block px-4 py-2 font-medium uppercase tracking-wide text-ink-900 hover:bg-band">{l}</Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
      <form action="/catalog" className="px-4 pb-3 xl:hidden">
        <div className="relative">
          <input name="q" defaultValue={defaultQuery} placeholder="Search products, SKU, model..."
            className="h-10 w-full rounded bg-[#e2ecf4] pl-3 pr-9 text-sm text-ink placeholder:text-[#5b6b7c] focus:outline-none" />
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-brand" />
        </div>
      </form>
    </header>
  );
}

export function MobileBottomNav() {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted hover:text-brand";
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
  const wa = whatsappLink(company?.whatsapp_number, "Hello Fermier Agency, I have an enquiry.");
  const link = "text-[11px] text-white/75 hover:text-white";
  return (
    <footer className="bg-footer pb-16 text-white md:pb-0">
      <div className="container-site flex flex-wrap items-center gap-x-7 gap-y-4 py-4 xl:flex-nowrap xl:justify-between xl:gap-x-5">
        <Logo footer />
        <nav className="flex shrink-0 items-center gap-2 text-white/40" aria-label="Sectors">
          {[["Construction", "/catalog/construction-equipment"], ["Lifting", "/catalog/lifting-equipment"], ["Power", "/catalog/generators"], ["Agri", "/catalog/agriculture-garden-equipment"]].map(([l, h], i) => (
            <span key={l} className="flex items-center gap-2">{i > 0 && <span className="text-[10px]">|</span>}<Link href={h} className={link}>{l}</Link></span>
          ))}
        </nav>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 xl:flex-nowrap xl:whitespace-nowrap" aria-label="Footer">
          {[["/", "Home"], ["/catalog", "Products"], ["/categories", "Categories"], ["/brands", "Brands"], ["/services", "Services"], ["/about", "About"], ["/contact", "Contact"]].map(([h, l]) => (
            <Link key={h} href={h} className={link}>{l}</Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 xl:flex-nowrap xl:whitespace-nowrap">
          {company?.phone && <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className={`${link} flex items-center gap-2`}><Phone className="h-4 w-4" />{company.phone}</a>}
          {company?.email && <a href={`mailto:${company.email}`} className={`${link} flex items-center gap-2`}><Mail className="h-4 w-4" />{company.email}</a>}
          {company?.address && <span className={`${link} flex items-center gap-2`}><MapPin className="h-4 w-4" />{company.address}</span>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${link} flex items-center gap-2`} aria-label="WhatsApp"><WhatsAppIcon className="h-4 w-4 text-[#25D366]" /></a>}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-white/40">
        © {new Date().getFullYear()} {company?.company_name ?? "Fermier Agency"}. Demo environment — prices, stock and testimonials shown are sample data.
      </div>
    </footer>
  );
}

