import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderQuotationPdf } from "@/lib/pdf/quotation";
import { previewTotals } from "@/lib/money";
import { parseCsv, toCsv } from "@/lib/csv";

const q = {
  id: "q1", quotation_number: "QT-26-00001", revision: 2, quotation_date: "2026-10-20", expiry_date: "2026-11-19", status: "sent", currency: "INR",
  subtotal: "305000.00", discount_total: "12500.00", tax_total: "52650.00", shipping_charges: "1500.00", other_charges: "0.00", grand_total: "346650.00",
  billing_address: "Demo address", delivery_address: "Demo site", payment_terms: "Net 30", delivery_terms: "Ex-warehouse", notes: "Sample", terms_and_conditions: "1. Sample terms",
  customers: { company_name: "Sample Builders Pvt Ltd (Demo)", customer_code: "CUS-DEMO-001", gstin: null, primary_contact: "Demo", email: "a@b.c", phone: "1", billing_address: "x", state: "TN" },
  profiles: { full_name: "Sales Exec", email: "s@x" },
};
const items = [
  { sku_snapshot: "YT-WN-500P", name_snapshot: "Y-tal 500 kg Winch — Plus Model", description_snapshot: "Heavy duty", unit: "Nos", quantity: "4", unit_price: "62500.00", discount_pct: "5", tax_rate: "18", tax_amount: "42750.00", line_total: "280250.00" },
];
function fakeClient() {
  const result = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "quotations" ? q : null }), order: async () => ({ data: items }) }),
      maybeSingle: async () => ({ data: { company_name: "Fermier Agency", address: "Addr", phone: "0", email: "e@x", gstin: null } }) }),
  });
  return { from: (t: string) => result(t) } as never;
}

describe("quotation PDF", () => {
  it("renders a valid PDF containing the quotation number", async () => {
    const out = await renderQuotationPdf(fakeClient(), "q1");
    expect(out).not.toBeNull();
    expect(out!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(out!.filename).toBe("QT-26-00001-rev2.pdf");
    expect(out!.buffer.length).toBeGreaterThan(2000);
  }, 30_000);
});

describe("money preview", () => {
  it("matches the server-side totals for the reference quotation", () => {
    const t = previewTotals([
      { quantity: 4, unit_price: "62500", discount_pct: "5", tax_rate: "18" },
      { quantity: 2, unit_price: "27500", discount_pct: "0", tax_rate: "18" },
    ], "1500", "0");
    expect(t).toEqual({ subtotal: 305000, discount: 12500, tax: 52650, shipping: 1500, other: 0, grand: 346650 });
  });
  it("avoids float drift", () => {
    expect(previewTotals([{ quantity: 3, unit_price: "0.10", discount_pct: "0", tax_rate: "0" }], 0, 0).grand).toBe(0.3);
  });
});

describe("csv", () => {
  it("round-trips quotes, commas and newlines and neutralises formulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'he said "hi"\nok'], ["=SUM(A1)", "2"]]);
    const rows = parseCsv(csv);
    expect(rows[1]).toEqual(["x,y", 'he said "hi"\nok']);
    expect(rows[2][0]).toBe("'=SUM(A1)");
  });
});
