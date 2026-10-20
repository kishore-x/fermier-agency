import { cn, humanize } from "@/lib/utils";

const TONE: Record<string, string> = {
  // positive
  active: "green", approved: "green", accepted: "green", verified: "green", confirmed: "green", delivered: "green",
  completed: "green", dispatched: "green", created: "green", succeeded: "green", paid: "green", in_stock: "green",
  converted: "green", stock_reserved: "blue",
  // in-progress
  new: "blue", assigned: "blue", contacted: "blue", sent: "blue", viewed: "blue", received: "blue", processing: "blue",
  quotation_in_preparation: "blue", quotation_sent: "blue", ready_for_dispatch: "blue", partially_fulfilled: "amber",
  awaiting_response: "amber", pending_approval: "amber", pending_confirmation: "amber", pending: "amber",
  requires_correction: "amber", low_stock: "amber", draft: "gray", mock: "violet", on_request: "gray",
  // negative
  rejected: "red", cancelled: "red", failed: "red", expired: "gray", inactive: "gray", closed: "gray", archived: "gray",
  out_of_stock: "red", overdue: "red", unsynced: "gray",
};

const CLASSES: Record<string, string> = {
  green: "bg-brand-50 text-brand-600 ring-brand/25",
  blue: "bg-navy-50 text-navy ring-navy/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-danger ring-danger/20",
  gray: "bg-canvas text-muted ring-line",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  const key = status ?? "unsynced";
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
      CLASSES[TONE[key] ?? "gray"], className)}>
      {label ?? humanize(key)}
    </span>
  );
}

export function stockStatus(available: number, reorder: number) {
  if (available <= 0) return "out_of_stock";
  if (available <= reorder) return "low_stock";
  return "in_stock";
}
