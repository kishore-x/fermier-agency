import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";

// Never split words across lines (the default hyphenation breaks model names and units).
Font.registerHyphenationCallback((word) => [word]);
import type { SupabaseClient } from "@supabase/supabase-js";

const NAVY = "#0f3a68";
const INK = "#0e1b2c";
const MUTED = "#5b6472";
const LINE = "#e3e8ef";
const ROW = "#f6f8fb";
const ACCENT = "#3a95f7";

const s = StyleSheet.create({
  page: { paddingTop: 92, paddingBottom: 120, paddingHorizontal: 36, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  header: { position: "absolute", top: 0, left: 0, right: 0, height: 72, paddingHorizontal: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: NAVY },
  logo: { height: 30, objectFit: "contain" },
  contact: { flexDirection: "row", gap: 14, fontSize: 9, fontFamily: "Helvetica-Bold", color: INK },
  eyebrow: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: "Helvetica-Bold", color: INK, marginTop: 4 },
  cat: { fontSize: 11, fontFamily: "Helvetica-Bold", color: MUTED, marginTop: 6, letterSpacing: 0.6 },
  type: { fontSize: 10, color: MUTED, marginTop: 6 },
  badges: { flexDirection: "row", marginTop: 26 },
  badge: { flex: 1, alignItems: "center", paddingHorizontal: 1 },
  badgeDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#eaf1fb", alignItems: "center", justifyContent: "center", marginBottom: 5 },
  badgeLabel: { fontSize: 5.8, textAlign: "center", fontFamily: "Helvetica-Bold", color: INK, lineHeight: 1.25 },
  quick: { marginTop: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#9fb3c8", borderRadius: 6, padding: 10 },
  quickTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 6 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", color: INK, marginTop: 22, marginBottom: 8 },
  th: { flexDirection: "row", backgroundColor: NAVY, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  thCell: { color: "white", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 7, paddingHorizontal: 10, letterSpacing: 0.6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE },
  tdLabel: { width: "45%", paddingVertical: 7, paddingHorizontal: 10, fontFamily: "Helvetica-Bold" },
  tdValue: { width: "55%", paddingVertical: 7, paddingHorizontal: 10 },
  boxRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  box: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
  boxTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 8 },
  smallTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 1, textAlign: "center", marginBottom: 8 },
  bullet: { marginBottom: 4, fontFamily: "Helvetica-Bold", fontSize: 9 },
  adv: { flexDirection: "row", gap: 6, marginBottom: 6 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 104, backgroundColor: "#0b2140", paddingHorizontal: 36, paddingTop: 16, color: "white" },
  footCols: { flexDirection: "row", gap: 22 },
  footHead: { fontSize: 8, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 0.8, marginBottom: 5 },
  footText: { fontSize: 7.5, color: "#c8d3e0", lineHeight: 1.45 },
  copy: { position: "absolute", bottom: 10, left: 36, right: 36, textAlign: "center", fontSize: 6.5, color: "#7d8ca0", letterSpacing: 0.8, borderTopWidth: 0.5, borderTopColor: "#2a4466", paddingTop: 7 },
});

type Spec = { label: string; value: string };
export type DatasheetData = {
  name: string; sku: string; type: string | null; categoryName: string; brandName: string | null; model: string | null;
  specs: Spec[]; applications: string[]; advantages: string[]; kit: string[]; warranty: string | null; imagePath: string | null;
  company: { name: string; phone: string | null; email: string | null; address: string | null; website: string };
};

const BADGES = ["HEAVY DUTY\nBUILD", "HIGH\nPERFORMANCE", "EASY TO\nOPERATE", "LOW\nMAINTENANCE", "RELIABLE &\nDURABLE", "SERVICE &\nSPARES"];

function Tick({ size = 9, color = NAVY }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const GENERIC_ADVANTAGES = [
  "Robust build for demanding site conditions.",
  "High productivity with low operating cost.",
  "Simple to operate and easy to maintain.",
  "Backed by Fermier Agency service and genuine spares.",
];

function warrantyHeadline(w: string | null) {
  const m = w?.match(/(\d+)\s*month/i);
  return m ? `${m[1]} MONTHS` : "AS PER OEM";
}

function Datasheet({ d, logo }: { d: DatasheetData; logo: string | null }) {
  const quick = [["Brand / Make", d.brandName], ["Category", d.categoryName], ...d.specs.slice(0, 2).map((x) => [x.label, x.value])].filter(([, v]) => v) as [string, string][];
  const table: Spec[] = [
    ...(d.brandName ? [{ label: "Brand / Make", value: d.brandName }] : []),
    { label: "Category", value: d.categoryName },
    ...(d.model && d.model !== d.name ? [{ label: "Model", value: d.model }] : []),
    { label: "Product code", value: d.sku },
    ...d.specs,
  ];
  const year = new Date().getFullYear();
  return (
    <Document title={`${d.name} — Product Data Sheet | ${d.company.name}`} author={d.company.name} subject="Product data sheet">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY }}>{d.company.name}</Text>}
          <View style={s.contact}>
            {d.company.phone && <Text>{d.company.phone}</Text>}
            {d.company.email && <Text>{d.company.email}</Text>}
            <Text>{d.company.website}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 18 }}>
          <View style={{ flex: 1.15 }}>
            <Text style={s.eyebrow}>PRODUCT DATA SHEET</Text>
            <Text style={s.title}>{d.name}</Text>
            <Text style={s.cat}>{d.categoryName.toUpperCase()}</Text>
            {d.type && <Text style={s.type}>{d.type}</Text>}
            <View style={s.badges}>
              {BADGES.map((b) => (
                <View key={b} style={s.badge}>
                  <View style={s.badgeDot}><Tick size={10} /></View>
                  <Text style={s.badgeLabel}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {d.imagePath && <Image src={d.imagePath} style={{ height: 150, objectFit: "contain" }} />}
            <View style={s.quick}>
              <Text style={s.quickTitle}>QUICK SPECIFICATIONS</Text>
              {quick.map(([k, v]) => (
                <View key={k} style={s.quickRow}><Text style={{ color: MUTED }}>{k}</Text><Text style={{ fontFamily: "Helvetica-Bold", maxWidth: 140, textAlign: "right" }}>{v}</Text></View>
              ))}
            </View>
          </View>
        </View>

        <Text style={s.h2}>SPECIFICATIONS</Text>
        <View style={s.th} fixed={false}>
          <Text style={[s.thCell, { width: "45%" }]}>SPECIFICATION</Text>
          <Text style={[s.thCell, { width: "55%" }]}>DETAILS</Text>
        </View>
        {table.map((r, i) => (
          <View key={`${r.label}-${i}`} style={[s.tr, { backgroundColor: i % 2 ? ROW : "white" }]} wrap={false}>
            <Text style={s.tdLabel}>{r.label}</Text><Text style={s.tdValue}>{r.value}</Text>
          </View>
        ))}

        <View style={s.boxRow} wrap={false}>
          <View style={s.box}>
            <Text style={s.boxTitle}>APPLICATIONS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {d.applications.slice(0, 8).map((a) => <Text key={a} style={[s.bullet, { width: "50%", paddingRight: 8 }]}>• {a}</Text>)}
            </View>
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>ADVANTAGES</Text>
            {d.advantages.slice(0, 4).map((a) => (
              <View key={a} style={s.adv}><View style={{ marginTop: 1 }}><Tick size={10} /></View><Text style={{ flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9 }}>{a}</Text></View>
            ))}
          </View>
        </View>
        <View style={s.boxRow} wrap={false}>
          <View style={s.box}>
            <Text style={s.smallTitle}>STANDARD KIT</Text>
            {d.kit.map((k) => <Text key={k} style={s.bullet}>• {k}</Text>)}
          </View>
          <View style={[s.box, { alignItems: "center" }]}>
            <Text style={s.smallTitle}>WARRANTY</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, marginTop: 6 }}>{warrantyHeadline(d.warranty)}</Text>
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 3, letterSpacing: 0.8, textAlign: "center" }}>{(d.warranty ?? "As per manufacturer terms").toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <View style={s.footCols}>
            <View style={{ flex: 1.1 }}>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5 }}>{d.company.name}</Text>
              <Text style={s.footText}>Your trusted partner in high-performance construction equipment. Authorized distributor since 1981.</Text>
            </View>
            <View style={{ flex: 0.9 }}>
              <Text style={s.footHead}>CONNECT WITH US</Text>
              {d.company.phone && <Text style={s.footText}>{d.company.phone}</Text>}
              {d.company.email && <Text style={s.footText}>{d.company.email}</Text>}
              <Text style={s.footText}>{d.company.website}</Text>
            </View>
            <View style={{ flex: 1.3 }}>
              <Text style={s.footHead}>CORPORATE OFFICE</Text>
              <Text style={s.footText}>{d.company.address ?? ""}</Text>
            </View>
          </View>
          <Text style={s.copy} render={({ pageNumber, totalPages }) => `© ${year} ${d.company.name.toUpperCase()}. SPECIFICATIONS SUBJECT TO CHANGE WITHOUT NOTICE.   PAGE ${pageNumber} OF ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

const PUBLIC = join(process.cwd(), "public");

/** Local PNG/JPEG for the PDF. Product photos are WebP, so use the JPEG copy made by the catalogue importer. */
function pdfImage(url: string | null): string | null {
  if (!url || !url.startsWith("/")) return null;
  const clean = url.split("?")[0];
  const candidates = [clean.replace(/^\/catalog\/products\/(.+)\.webp$/, "/catalog/datasheet/$1.jpg"), clean];
  for (const c of candidates) {
    if (!/\.(png|jpe?g)$/i.test(c)) continue;
    const p = join(PUBLIC, c);
    if (p.startsWith(PUBLIC) && existsSync(p)) return p;
  }
  return null;
}

export async function renderDatasheet(supabase: SupabaseClient, slug: string) {
  const { data: p } = await supabase.from("catalog_products").select("*").eq("slug", slug).maybeSingle();
  if (!p) return null;
  const [{ data: specs }, { data: cat }, { data: co }] = await Promise.all([
    supabase.from("product_specifications").select("label, value").eq("product_id", p.id).order("sort_order"),
    supabase.from("categories").select("applications, key_points").eq("id", p.category_id).maybeSingle(),
    supabase.from("company_settings").select("company_name, phone, email, address").maybeSingle(),
  ]);
  const all = (specs ?? []) as Spec[];
  const data: DatasheetData = {
    name: p.name, sku: p.sku, model: p.model_number, brandName: p.brand_name, categoryName: p.category_name ?? "",
    type: all.find((x) => x.label === "Type")?.value ?? p.short_description,
    specs: all.filter((x) => x.label !== "Type"),
    applications: (p.applications?.length ? p.applications : cat?.applications ?? []) as string[],
    advantages: (p.features?.length ? p.features : GENERIC_ADVANTAGES) as string[],
    kit: (p.in_the_box?.length ? p.in_the_box : ["Machine unit", "Tool kit", "Operator manual"]) as string[],
    warranty: p.warranty, imagePath: pdfImage(p.image_url),
    company: { name: co?.company_name ?? "Fermier Agency", phone: co?.phone ?? null, email: co?.email ?? null, address: co?.address ?? null, website: "www.fermieragency.com" },
  };
  const logoPath = join(PUBLIC, "site", "logo-hd.png");
  const buffer = await renderToBuffer(<Datasheet d={data} logo={existsSync(logoPath) ? readFileSync(logoPath) as unknown as string : null} />);
  return { buffer, filename: `${p.name.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-")}-Datasheet-Fermier-Agency.pdf` };
}
