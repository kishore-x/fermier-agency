"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart";

export function CartLink({ className, variant = "header" }: { className?: string; variant?: "header" | "tab" }) {
  const { count, ready } = useCart();
  const badge = (variant === "header" || (ready && count > 0)) && (
    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-4 text-white tnum">
      {!ready ? 0 : count > 99 ? "99+" : count}
    </span>
  );
  if (variant === "tab") {
    return (
      <Link href="/portal/cart" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted hover:text-navy">
        <span className="relative"><ShoppingCart className="h-5 w-5" />{badge}</span>Cart
      </Link>
    );
  }
  return (
    <Link href="/portal/cart" className={cn("relative items-center rounded-md p-2 hover:bg-white/10", className)} aria-label={`Cart, ${count} items`}>
      <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />{badge}
    </Link>
  );
}
