import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { MetricCard } from "@/components/ui/data";
import { Alert, Card, CardHeader, LinkButton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { markMyNotificationsRead } from "./actions";

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const session = await requireCustomer();
  const { welcome } = (await searchParams) as { welcome?: string };
  const supabase = await createClient();
  // RLS restricts every query below to this customer's own records.
  const [{ data: orders }, { data: quotes }, { data: requests }, { data: invoices }, { data: notes }] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number, status, grand_total, order_date").order("created_at", { ascending: false }).limit(20),
    supabase.from("quotations").select("id, quotation_number, status, grand_total, expiry_date").order("created_at", { ascending: false }).limit(20),
    supabase.from("enquiries").select("id, enquiry_number, status, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id, sales_order_id, external_invoice_number, is_mock, sync_status, total, balance_due, due_date").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id, title, link, read_at, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(6),
  ]);
  const pendingQuotes = (quotes ?? []).filter((q) => ["sent", "viewed"].includes(q.status));
  const awaitingConfirm = (quotes ?? []).filter((q) => q.status === "accepted");
  const awaitingDispatch = (orders ?? []).filter((o) => ["confirmed", "stock_reserved", "partially_fulfilled", "ready_for_dispatch"].includes(o.status));
  const synced = (invoices ?? []).filter((i) => i.sync_status === "created" || i.is_mock);
  const outstanding = synced.reduce((a, i) => a + Number(i.balance_due ?? 0), 0);
  const unsynced = (invoices ?? []).length - synced.length;

  return (
    <>
      {welcome && <Alert tone="success" className="mb-4">Welcome! Your trade account is ready. Browse the catalog and add products to your cart to request a quotation.</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Quotations to review" value={pendingQuotes.length} href="/portal/quotations" tone={pendingQuotes.length ? "ok" : undefined} />
        <MetricCard label="Awaiting your PO / confirmation" value={awaitingConfirm.length} href="/portal/quotations" />
        <MetricCard label="Orders awaiting dispatch" value={awaitingDispatch.length} href="/portal/orders" />
        <MetricCard label="Outstanding invoices" value={formatMoney(outstanding)} href="/portal/invoices" hint={unsynced ? `${unsynced} invoice(s) not yet synchronised` : "From synchronised invoices"} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent orders" action={<Link href="/portal/orders" className="text-xs text-navy hover:underline">All orders</Link>} />
          <List rows={(orders ?? []).slice(0, 5).map((o) => ({ id: o.id, href: `/portal/orders/${o.id}`, label: o.order_number, status: o.status, right: formatMoney(o.grand_total), sub: formatDate(o.order_date) }))} empty="No orders yet." />
        </Card>
        <Card>
          <CardHeader title="Quotations" action={<Link href="/portal/quotations" className="text-xs text-navy hover:underline">All quotations</Link>} />
          <List rows={(quotes ?? []).slice(0, 5).map((q) => ({ id: q.id, href: `/portal/quotations/${q.id}`, label: q.quotation_number, status: q.status, right: formatMoney(q.grand_total), sub: `Valid until ${formatDate(q.expiry_date)}` }))} empty="No quotations yet." />
        </Card>
        <Card>
          <CardHeader title="Recent requests" action={<LinkButton href="/catalog" size="sm" variant="success">New request</LinkButton>} />
          <List rows={(requests ?? []).map((r) => ({ id: r.id, href: `/portal/enquiries/${r.id}`, label: r.enquiry_number, status: r.status, sub: formatDate(r.created_at) }))} empty="You haven't submitted any order requests yet." />
        </Card>
        <Card>
          <CardHeader title="Updates" action={(notes ?? []).some((n) => !n.read_at) && <ActionForm action={async () => { "use server"; return markMyNotificationsRead(); }}><SubmitButton size="sm" variant="ghost">Mark all read</SubmitButton></ActionForm>} />
          <ul className="divide-y divide-line text-sm">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="flex items-start gap-2 px-4 py-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-line" : "bg-brand"}`} />
                <div>{n.link ? <Link href={n.link} className="text-navy hover:underline">{n.title}</Link> : n.title}<p className="text-xs text-muted">{formatDateTime(n.created_at)}</p></div>
              </li>
            ))}
            {!notes?.length && <li className="px-4 py-4 text-muted">No updates yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

function List({ rows, empty }: { rows: { id: string; href: string; label: string; status: string; right?: string; sub?: string }[]; empty: string }) {
  if (!rows.length) return <p className="px-4 py-4 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex-1"><Link href={r.href} className="font-medium text-navy hover:underline">{r.label}</Link>{r.sub && <p className="text-xs text-muted">{r.sub}</p>}</div>
          <StatusBadge status={r.status} />
          {r.right && <span className="w-28 text-right tnum">{r.right}</span>}
        </li>
      ))}
    </ul>
  );
}
