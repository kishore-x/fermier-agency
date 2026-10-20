import Link from "next/link";
import { ArrowRight, Cog, Handshake, Truck, Wrench } from "lucide-react";
import { PageHero } from "@/components/catalog/page-hero";
import { SITE } from "@/lib/site-content";

export const metadata = { title: "Services" };
const ICONS = [Handshake, Wrench, Cog, Truck];

export default function ServicesPage() {
  return (
    <div className="bg-page pb-12">
      <PageHero eyebrow="Services" title="Sales, service, spares & rental support" text="Support for the full life of your equipment — from selection to after-sales." />
      <div className="mx-auto grid max-w-[1200px] gap-3 px-4 pt-8 md:grid-cols-2">
        {SITE.services.map((s, i) => {
          const I = ICONS[i];
          return (
            <div key={s.title} id={s.title.toLowerCase().replace(/\s+/g, "-")} className="flex gap-4 rounded-sm border border-[#e3e8ef] bg-white p-6">
              <I className="h-8 w-8 shrink-0 text-brand" strokeWidth={1.5} />
              <div><h2 className="font-display text-xl font-bold uppercase text-ink-900">{s.title}</h2><p className="mt-1 text-sm leading-relaxed text-[#5b6472]">{s.text}</p></div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto mt-6 max-w-[1200px] px-4">
        <Link href="/contact" className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-6 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-600">Get enquiry <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
