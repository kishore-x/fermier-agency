import Link from "next/link";
import { Download } from "lucide-react";
import { Alert, Card, Input, LinkButton, PageHeader, Select } from "@/components/ui/primitives";
import { can, requireStaff } from "@/lib/auth";
import { dateRange, REPORT_TABS, runReport, type ReportTab } from "@/lib/queries/reports";
import { formatDateTime, formatMoney, formatQty, humanize } from "@/lib/utils";

const MONEY_HEADERS = /value|revenue|cost|total|balance/i;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const session = await requireStaff();
  const sp = (await searchParams) as Record<string, string | undefined>;
  const financial = can.financialReports(session);
  const costs = can.viewCost(session);
  const allowed = REPORT_TABS.filter(([k]) => (["sales", "quotations", "pending", "invoices"].includes(k) ? financial : k === "inventory" ? costs : true));
  const tab = (allowed.find(([k]) => k === sp.tab)?.[0] ?? allowed[0]?.[0]) as ReportTab | undefined;
  const { from, to } = dateRange(sp);
  const dim = ["period", "product", "category", "customer", "salesperson"].includes(sp.dim ?? "") ? sp.dim! : "period";
  let report = null; let error: string | null = null;
  if (tab) { try { report = await runReport(tab, from, to, dim); } catch (e) { error = e instanceof Error ? e.message : "Report failed"; } }
  const qs = new URLSearchParams({ tab: tab ?? "", from, to, dim }).toString();
  const usesDates = tab === "sales" || tab === "quotations" || tab === "movements";
  const showDim = tab === "sales";

  return (
    <>
      <PageHeader title="Reports" description="Calculated live from the database. Financial reports and cost data follow your role permissions."
        actions={tab && <LinkButton href={`/admin/reports/export?${qs}`} variant="outline" prefetch={false}><Download className="h-4 w-4" />Export CSV</LinkButton>} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {allowed.map(([k, l]) => <Link key={k} href={`?tab=${k}&from=${from}&to=${to}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-navy font-medium text-navy" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>)}
      </div>
      {!tab && <Alert>No reports are available for your role.</Alert>}
      {tab && (
        <Card>
          {usesDates && (
            <form className="flex flex-wrap items-end gap-2 border-b border-line p-3">
              <input type="hidden" name="tab" value={tab} />
              <label className="text-sm">From<Input type="date" name="from" defaultValue={from} className="mt-1 w-40" /></label>
              <label className="text-sm">To<Input type="date" name="to" defaultValue={to} className="mt-1 w-40" /></label>
              {showDim && (
                <label className="text-sm">Group by<Select name="dim" defaultValue={dim} className="mt-1 w-40">
                  {["period", "product", "category", "customer", "salesperson"].map((d) => <option key={d} value={d}>{d === "period" ? "Month" : humanize(d)}</option>)}
                </Select></label>
              )}
              <button className="h-10 rounded-md bg-navy px-4 text-sm font-medium text-white">Run</button>
            </form>
          )}
          {error && <Alert tone="error" className="m-4">{error}</Alert>}
          {report && (
            <>
              {report.summary && <div className="flex flex-wrap gap-6 border-b border-line px-4 py-3 text-sm">{report.summary.map(([k, v]) => <div key={k}><p className="text-xs text-muted">{k}</p><p className="text-lg font-semibold tnum">{/value/i.test(k) ? formatMoney(v) : v}</p></div>)}</div>}
              {report.note && <p className="border-b border-line bg-canvas/50 px-4 py-2 text-xs text-muted">{report.note}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted">{report.headers.map((h, i) => <th key={h} className={`px-4 py-2 ${report!.numeric.includes(i) ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-line">
                        {r.map((c, i) => {
                          const num = report!.numeric.includes(i);
                          const numeric = typeof c === "number" || (typeof c === "string" && /^-?\d+(\.\d+)?$/.test(c));
                          const v = c === null ? <span className="text-muted">{report!.headers[i] === "Balance" ? "Unsynchronised" : "—"}</span>
                            : num && numeric ? (MONEY_HEADERS.test(report!.headers[i]) ? formatMoney(c) : formatQty(c))
                            : report!.headers[i] === "When" ? formatDateTime(String(c))
                            : ["Status", "Type", "Source"].includes(report!.headers[i]) ? humanize(String(c)) : String(c);
                          return <td key={i} className={`px-4 py-2 ${num ? "text-right tnum" : ""}`}>{v}</td>;
                        })}
                      </tr>
                    ))}
                    {!report.rows.length && <tr><td colSpan={report.headers.length} className="px-4 py-8 text-center text-muted">No data for this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
