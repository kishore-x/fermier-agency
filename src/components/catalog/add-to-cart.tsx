"use client";

import { useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useCart } from "./cart";

type P = { id: string; slug: string; sku: string; name: string; display_price: string | null; image_url: string | null; unit: string };

export function AddToCartButton({ product, className, compact, withQty, label: forcedLabel, arrow }: { product: P; className?: string; compact?: boolean; withQty?: boolean; label?: string; arrow?: boolean }) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const add = () => {
    cart.add({ productId: product.id, slug: product.slug, sku: product.sku, name: product.name, price: product.display_price,
      imageUrl: product.image_url, unit: product.unit }, qty);
    toast(`${product.name} added to your quote request`);
  };
  const label = forcedLabel ?? (product.display_price ? "Add to cart" : "Request quote");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {withQty && (
        <div className="flex h-12 items-center rounded-md border border-line bg-white">
          <button type="button" className="px-3 text-muted hover:text-ink" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
          <input type="number" min={1} max={9999} value={qty} aria-label="Quantity"
            onChange={(e) => setQty(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
            className="w-14 border-x border-line text-center text-sm tnum focus:outline-none" />
          <button type="button" className="px-3 text-muted hover:text-ink" onClick={() => setQty((q) => Math.min(9999, q + 1))} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
        </div>
      )}
      <Button type="button" variant="success" size={compact ? "sm" : "lg"} className="flex-1" onClick={add}>
        {!arrow && <ShoppingCart className="h-4 w-4" />} {label}{arrow && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
