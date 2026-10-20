import {
  Anvil, Car, Cog, Construction, Drill, Flame, Forklift, Gauge, Package, Sprout, SprayCan, Wind, Zap, Container,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Cog> = {
  "construction-equipment": Construction,
  "lifting-equipment": Anvil,
  "material-handling-equipment": Forklift,
  generators: Zap,
  "car-washers-vacuum-cleaners": Car,
  "agriculture-garden-equipment": Sprout,
  "air-compressors": Gauge,
  "fogging-machines": Wind,
  "pressure-washers": SprayCan,
  "mini-cranes": Container,
  "welding-equipment": Flame,
  "power-tools": Drill,
};

export function CategoryIcon({ slug, className }: { slug: string | null | undefined; className?: string }) {
  const Icon = (slug && ICONS[slug]) || Package;
  return <Icon className={cn("h-6 w-6", className)} strokeWidth={1.5} />;
}

/** Image with a neutral placeholder when no product photo has been uploaded yet. */
export function ProductImage({ src, alt, categorySlug, className }: { src: string | null; alt: string; categorySlug?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={cn("h-full w-full object-contain", className)} loading="lazy" />;
  }
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-canvas to-white text-navy/40", className)}
      role="img" aria-label={`${alt} — image coming soon`}>
      <CategoryIcon slug={categorySlug} className="h-10 w-10" />
      <span className="text-[10px] uppercase tracking-wider text-muted">Image coming soon</span>
    </div>
  );
}
