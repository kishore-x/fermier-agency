import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";

const NAVY = "#191A3D";
const GREEN = "#4CAF50";
const MUTED = "#737784";
const LINE = "#E5E7EB";

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#171923" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 12 },
  logo: { width: 28, height: 28, backgroundColor: GREEN, color: "white", fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 6, marginRight: 8 },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY },
  small: { fontSize: 8, color: MUTED, marginTop: 2 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  row: { flexDirection: "row" },
  box: { flex: 1, borderWidth: 1, borderColor: LINE, padding: 8, marginTop: 12 },
  block: { borderWidth: 1, borderColor: LINE, padding: 8, marginTop: 12 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", marginBottom: 2 },
  th: { backgroundColor: NAVY, color: "white", fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 4, fontSize: 8 },
  td: { paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  totals: { marginTop: 8, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, marginTop: 4, borderTopWidth: 1.5, borderTopColor: NAVY, fontFamily: "Helvetica-Bold", fontSize: 11 },
  watermark: { position: "absolute", top: 360, left: 120, fontSize: 60, color: "#f1d6d6", transform: "rotate(-30deg)" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: MUTED, textAlign: "center" },
});

const inr = (v: string | number | null) =>
  v === null || v === undefined ? "-" : "Rs. " + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));
const date = (d: string | null) => (d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(d)) : "-");

const COLS = [
  { k: "#", w: "4%" }, { k: "Item", w: "30%" }, { k: "Qty", w: "8%", r: true }, { k: "Unit price", w: "14%", r: true },
  { k: "Disc.", w: "6%", r: true }, { k: "GST", w: "6%", r: true }, { k: "Tax", w: "15%", r: true }, { k: "Amount", w: "17%", r: true },
];

type Q = Record<string, unknown> & {
  quotation_number: string; revision: number; quotation_date: string; expiry_date: string; status: string; currency: string;
  subtotal: string; discount_total: string; tax_total: string; shipping_charges: string; other_charges: string; grand_total: string;
  billing_address: string | null; delivery_address: string | null; payment_terms: string | null; delivery_terms: string | null;
  notes: string | null; terms_and_conditions: string | null;
  customers: { company_name: string; customer_code: string; gstin: string | null; primary_contact: string | null; email: string | null; phone: string | null; billing_address: string | null; state: string | null };
  profiles: { full_name: string; email: string } | null;
};
type Item = { sku_snapshot: string; name_snapshot: string; description_snapshot: string | null; unit: string; quantity: string; unit_price: string; discount_pct: string; tax_rate: string; tax_amount: string; line_total: string };
type Company = { company_name: string; legal_name: string | null; address: string | null; phone: string | null; email: string | null; gstin: string | null };

function QuotationDoc({ q, items, company }: { q: Q; items: Item[]; company: Company }) {
  const draft = ["draft", "pending_approval"].includes(q.status);
  return (
    <Document title={`Quotation ${q.quotation_number}`} author={company.company_name}>
      <Page size="A4" style={s.page}>
        {draft && <Text style={s.watermark}>DRAFT</Text>}
        <View style={s.header}>
          <View style={s.row}>
            <Text style={s.logo}>F</Text>
            <View>
              <Text style={s.company}>{company.company_name}</Text>
              {company.address && <Text style={s.small}>{company.address}</Text>}
              <Text style={s.small}>{[company.phone, company.email].filter(Boolean).join("  |  ")}</Text>
              {company.gstin && <Text style={s.small}>GSTIN: {company.gstin}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.title}>QUOTATION</Text>
            <Text style={[s.small, { textAlign: "right" }]}>{q.quotation_number}{q.revision > 1 ? `  (Rev ${q.revision})` : ""}</Text>
            <Text style={[s.small, { textAlign: "right" }]}>Date: {date(q.quotation_date)}</Text>
            <Text style={[s.small, { textAlign: "right", color: NAVY, fontFamily: "Helvetica-Bold" }]}>Valid until: {date(q.expiry_date)}</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 8 }]}>
          <View style={s.box}>
            <Text style={s.label}>Bill to</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{q.customers.company_name}</Text>
            <Text>{q.billing_address || q.customers.billing_address || ""}</Text>
            {q.customers.gstin && <Text>GSTIN: {q.customers.gstin}</Text>}
            <Text style={s.small}>{[q.customers.primary_contact, q.customers.phone, q.customers.email].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.label}>Deliver to</Text>
            <Text>{q.delivery_address || "As per billing address"}</Text>
            <Text style={[s.label, { marginTop: 6 }]}>Prepared by</Text>
            <Text>{q.profiles?.full_name ?? company.company_name}</Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={s.row} fixed>
            {COLS.map((c) => <Text key={c.k} style={[s.th, { width: c.w, textAlign: c.r ? "right" : "left" }]}>{c.k}</Text>)}
          </View>
          {items.map((it, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={[s.td, { width: COLS[0].w }]}>{i + 1}</Text>
              <View style={[s.td, { width: COLS[1].w }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{it.name_snapshot}</Text>
                <Text style={s.small}>{it.sku_snapshot}{it.description_snapshot ? ` — ${it.description_snapshot}` : ""}</Text>
              </View>
              <Text style={[s.td, { width: COLS[2].w, textAlign: "right" }]}>{Number(it.quantity)} {it.unit}</Text>
              <Text style={[s.td, { width: COLS[3].w, textAlign: "right" }]}>{inr(it.unit_price)}</Text>
              <Text style={[s.td, { width: COLS[4].w, textAlign: "right" }]}>{Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "-"}</Text>
              <Text style={[s.td, { width: COLS[5].w, textAlign: "right" }]}>{Number(it.tax_rate)}%</Text>
              <Text style={[s.td, { width: COLS[6].w, textAlign: "right" }]}>{inr(it.tax_amount)}</Text>
              <Text style={[s.td, { width: COLS[7].w, textAlign: "right" }]}>{inr(it.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{inr(q.subtotal)}</Text></View>
          {Number(q.discount_total) > 0 && <View style={s.totalRow}><Text>Discount</Text><Text>- {inr(q.discount_total)}</Text></View>}
          <View style={s.totalRow}><Text>GST</Text><Text>{inr(q.tax_total)}</Text></View>
          {Number(q.shipping_charges) > 0 && <View style={s.totalRow}><Text>Shipping</Text><Text>{inr(q.shipping_charges)}</Text></View>}
          {Number(q.other_charges) > 0 && <View style={s.totalRow}><Text>Other charges</Text><Text>{inr(q.other_charges)}</Text></View>}
          <View style={s.grand}><Text>Grand total ({q.currency})</Text><Text>{inr(q.grand_total)}</Text></View>
        </View>

        <View style={[s.row, { gap: 8, marginTop: 12 }]} wrap={false}>
          <View style={s.box}><Text style={s.label}>Payment terms</Text><Text>{q.payment_terms || "-"}</Text></View>
          <View style={s.box}><Text style={s.label}>Delivery terms</Text><Text>{q.delivery_terms || "-"}</Text></View>
        </View>
        {q.notes && <View style={s.block} wrap={false}><Text style={s.label}>Notes</Text><Text>{q.notes}</Text></View>}
        {q.terms_and_conditions && <View style={s.block}><Text style={s.label}>Terms & conditions</Text><Text>{q.terms_and_conditions}</Text></View>}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${company.company_name} · Quotation ${q.quotation_number} · Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

/** Loads with the caller's client so RLS decides who can render which quotation. */
export async function renderQuotationPdf(supabase: SupabaseClient, id: string) {
  const [{ data: q }, { data: items }, { data: company }] = await Promise.all([
    supabase.from("quotations").select("*, customers(company_name, customer_code, gstin, primary_contact, email, phone, billing_address, state), profiles!quotations_created_by_fkey(full_name, email)").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
    supabase.from("company_settings").select("company_name, legal_name, address, phone, email, gstin").maybeSingle(),
  ]);
  if (!q || !company) return null;
  const buffer = await renderToBuffer(<QuotationDoc q={q as Q} items={(items ?? []) as Item[]} company={company as Company} />);
  return { buffer, filename: `${(q as Q).quotation_number}${(q as Q).revision > 1 ? `-rev${(q as Q).revision}` : ""}.pdf`, quotation: q as Q };
}
