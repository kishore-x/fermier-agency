"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./category-icon";

export function ProductGallery({ images, name, categorySlug }: { images: { id: string; url: string; alt: string | null }[]; name: string; categorySlug: string | null }) {
  const [i, setI] = useState(0);
  const current = images[i];
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-lg border border-line bg-white p-4">
        <ProductImage src={current?.url ?? null} alt={current?.alt ?? name} categorySlug={categorySlug} />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button key={img.id} type="button" onClick={() => setI(idx)} aria-label={`Show image ${idx + 1}`}
              className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-white p-1", idx === i ? "border-brand ring-2 ring-brand/30" : "border-line")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
