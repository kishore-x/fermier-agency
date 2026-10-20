import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "./primitives";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
};

export function DataTable<T>({ columns, rows, rowKey, empty, rowHref }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: React.ReactNode; rowHref?: (r: T) => string;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-left text-xs font-medium uppercase tracking-wide text-muted">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-2.5 font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-canvas/50">
              {columns.map((c, i) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tnum", c.align === "center" && "text-center", c.className)}>
                  {rowHref && i === 0 ? <Link href={rowHref(r)} className="font-medium text-navy hover:underline">{c.cell(r)}</Link> : c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, pageSize, basePath, params }: {
  page: number; total: number; pageSize: number; basePath: string; params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span className="tnum">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous"><ChevronLeft className="h-4 w-4" /></PageLink>
        <span className="px-2 tnum">Page {page} of {pages}</span>
        <PageLink href={href(page + 1)} disabled={page >= pages} label="Next"><ChevronRight className="h-4 w-4" /></PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) return <span aria-disabled className="rounded-md border border-line p-1.5 opacity-40">{children}</span>;
  return <Link href={href} aria-label={label} className="rounded-md border border-line bg-white p-1.5 hover:bg-canvas">{children}</Link>;
}

export function MetricCard({ label, value, hint, href, tone }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; tone?: "warn" | "danger" | "ok";
}) {
  const body = (
    <Card className={cn("h-full p-4 transition-colors", href && "hover:border-navy/30")}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tnum text-ink", tone === "warn" && "text-amber-700", tone === "danger" && "text-danger", tone === "ok" && "text-brand-600")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export type TimelineItem = { id: string; title: React.ReactNode; body?: React.ReactNode; at: string; actor?: string | null; tone?: "default" | "success" | "warn" };
export function Timeline({ items, empty = "No activity yet." }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <p className="px-4 py-6 text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative space-y-4 p-4">
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", it.tone === "success" ? "bg-brand" : it.tone === "warn" ? "bg-amber-500" : "bg-navy")} />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-sm text-ink">{it.title}</p>
            {it.body && <div className="mt-0.5 whitespace-pre-line text-sm text-muted">{it.body}</div>}
            <p className="mt-0.5 text-xs text-muted">{formatDateTime(it.at)}{it.actor ? ` · ${it.actor}` : ""}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** GET-form filter bar. Works without JS; values live in the URL so they're shareable and paginate correctly. */
export function FilterBar({ children, action, resetHref }: { children: React.ReactNode; action: string; resetHref: string }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-b border-line p-3">
      {children}
      <button className="h-10 rounded-md bg-navy px-4 text-sm font-medium text-white hover:bg-navy-700">Apply</button>
      <Link href={resetHref} className="h-10 rounded-md px-3 text-sm leading-10 text-muted hover:text-ink">Clear</Link>
    </form>
  );
}
