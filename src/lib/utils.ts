import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "Asia/Kolkata";

export function formatMoney(value: string | number | null | undefined, currency = "INR") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatQty(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function humanize(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function str(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v.trim() : "";
}

export const PAGE_SIZE = 20;
export function pageRange(page: number, size = PAGE_SIZE) {
  const p = Math.max(1, page || 1);
  return { from: (p - 1) * size, to: p * size - 1, page: p };
}

/** Escape user input for use inside a PostgREST `or()`/`ilike` filter. */
export function searchTerm(q: string) {
  return q.replace(/[%,().*\\]/g, " ").trim().slice(0, 80);
}
