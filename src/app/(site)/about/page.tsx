import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/catalog/page-hero";
import { SITE } from "@/lib/site-content";

export const metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="bg-page pb-12">
      <PageHero eyebrow="About us" title={SITE.about.title.join(" ")} />
      <div className="container-site grid items-center gap-8 pt-8 md:grid-cols-[1fr_1.2fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/about-trowel.webp" alt="Operator finishing a concrete floor with a power trowel" className="w-full rounded-sm bg-gradient-to-b from-band to-white object-contain" />
        <div>
          <p className="text-[15px] leading-relaxed text-[#3d4652]">{SITE.about.text}</p>
          <ul className="mt-6 grid grid-cols-2 gap-3">
            {SITE.stats.map((s) => (
              <li key={s.label} className="rounded-sm border border-[#e3e8ef] bg-white p-4">
                <p className="font-display text-3xl font-bold text-brand">{s.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
              </li>
            ))}
          </ul>
          <Link href="/contact" className="mt-6 inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-6 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-600">Get enquiry <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
      <section className="container-site mt-10">
        <h2 className="font-display text-2xl font-bold uppercase text-ink-900">Why choose us</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SITE.reasons.map((r) => (
            <div key={r.title} className="rounded-sm border border-[#e3e8ef] bg-white p-4"><p className="font-bold text-ink-900">{r.title}</p><p className="text-sm text-muted">{r.text}</p></div>
          ))}
        </div>
      </section>
    </div>
  );
}
