// Client-side preview math in integer paise. The database recomputes authoritative totals with NUMERIC.
const toPaise = (v: string | number) => Math.round(Number(v || 0) * 100);
const roundDiv = (a: number, b: number) => Math.round(a / b);

export type PreviewLine = { quantity: string | number; unit_price: string | number; discount_pct: string | number; tax_rate: string | number };

export function previewLine(l: PreviewLine) {
  const qty = Number(l.quantity || 0);
  const sub = Math.round(qty * toPaise(l.unit_price));
  const disc = roundDiv(sub * toPaise(l.discount_pct), 10000);
  const tax = roundDiv((sub - disc) * toPaise(l.tax_rate), 10000);
  return { sub, disc, tax, total: sub - disc + tax };
}

export function previewTotals(lines: PreviewLine[], shipping: string | number, other: string | number) {
  const t = lines.map(previewLine).reduce((a, l) => ({ sub: a.sub + l.sub, disc: a.disc + l.disc, tax: a.tax + l.tax }), { sub: 0, disc: 0, tax: 0 });
  const ship = toPaise(shipping), oth = toPaise(other);
  return { subtotal: t.sub / 100, discount: t.disc / 100, tax: t.tax / 100, shipping: ship / 100, other: oth / 100, grand: (t.sub - t.disc + t.tax + ship + oth) / 100 };
}
