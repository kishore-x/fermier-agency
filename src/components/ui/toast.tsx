"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type Toast = { id: number; tone: "success" | "error"; text: string };
const listeners = new Set<(t: Toast) => void>();
let seq = 0;

export function toast(text: string, tone: Toast["tone"] = "success") {
  const t = { id: ++seq, tone, text };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 4500);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-80 flex-col gap-2 md:bottom-4" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2 rounded-md border border-line bg-white p-3 text-sm shadow-lg">
          {t.tone === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> : <XCircle className="h-4 w-4 shrink-0 text-danger" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X className="h-4 w-4 text-muted" /></button>
        </div>
      ))}
    </div>
  );
}
