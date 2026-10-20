import { can, getSession } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { dateRange, REPORT_TABS, runReport, type ReportTab } from "@/lib/queries/reports";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.isStaff) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const tab = sp.tab as ReportTab;
  if (!REPORT_TABS.some(([k]) => k === tab)) return new Response("Unknown report", { status: 400 });
  if (["sales", "quotations", "pending", "invoices"].includes(tab) && !can.financialReports(session)) return new Response("Forbidden", { status: 403 });
  if (tab === "inventory" && !can.viewCost(session)) return new Response("Forbidden", { status: 403 });
  const { from, to } = dateRange(sp);
  try {
    const r = await runReport(tab, from, to, sp.dim ?? "period");
    return csvResponse(`report-${tab}-${from}-to-${to}.csv`, toCsv(r.headers, r.rows));
  } catch {
    return new Response("Report failed", { status: 500 });
  }
}
