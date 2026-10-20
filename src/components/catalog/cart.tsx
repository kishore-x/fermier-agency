"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = { productId: string; slug: string; sku: string; name: string; price: string | null; imageUrl: string | null; unit: string; quantity: number };
type Cart = {
  lines: CartLine[]; count: number; ready: boolean;
  add: (l: Omit<CartLine, "quantity">, qty: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const KEY = "fermier.cart.v1";
const Ctx = createContext<Cart | null>(null);

// Cart is a per-browser convenience; the persistent record is the order request created on submit.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLines(JSON.parse(raw));
    } catch { /* storage unavailable */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const add = useCallback((l: Omit<CartLine, "quantity">, qty: number) => {
    const q = Math.max(1, Math.min(9999, Math.floor(qty) || 1));
    setLines((s) => {
      const ex = s.find((x) => x.productId === l.productId);
      if (ex) return s.map((x) => (x.productId === l.productId ? { ...x, quantity: Math.min(9999, x.quantity + q) } : x));
      return [...s, { ...l, quantity: q }];
    });
  }, []);
  const setQty = useCallback((id: string, qty: number) => {
    setLines((s) => s.map((x) => (x.productId === id ? { ...x, quantity: Math.max(1, Math.min(9999, Math.floor(qty) || 1)) } : x)));
  }, []);
  const remove = useCallback((id: string) => setLines((s) => s.filter((x) => x.productId !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => ({ lines, count: lines.reduce((a, l) => a + l.quantity, 0), ready, add, setQty, remove, clear }),
    [lines, ready, add, setQty, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
