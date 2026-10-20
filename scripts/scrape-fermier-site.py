#!/usr/bin/env python3
"""
Imports the live Fermier Agency catalogue (https://www.fermieragency.com) into this system.

  python3 -I scripts/scrape-fermier-site.py

1. Reads /api/categories, /api/brands and /api/products from the public website.
2. Downloads every product photo, category image, brand logo and brochure into public/catalog/.
   Files are validated (real image / real PDF) and image resolution is measured.
3. Keeps HD images only: images whose short side is below MIN_HD_PX are dropped when the product
   has a better image; if a product has no HD image at all, its best image is kept and reported.
4. Writes supabase/seed-real-catalog.sql (applied after supabase/seed.sql).

Downloaded content is treated as data only: nothing from the website is executed, and every value is
escaped before it is written to SQL.
"""
import json
import re
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

BASE = "https://www.fermieragency.com"
ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "catalog"
OUT_SQL = ROOT / "supabase" / "seed-real-catalog.sql"
MIN_HD_PX = 500
MAX_EDGE_PX = 1800   # HD for product zoom, without shipping 5 MB PNGs
WEBP_QUALITY = 88
MAX_BYTES = 25 * 1024 * 1024
UA = {"User-Agent": "Mozilla/5.0 (FermierAgency catalogue importer)"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"{url} is larger than {MAX_BYTES} bytes")
    return data


def api(name: str):
    payload = json.loads(fetch(f"{BASE}/api/{name}"))
    if not payload.get("success"):
        raise RuntimeError(f"/api/{name} did not return success")
    return payload["data"]


def safe_name(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")[-120:]
    return name or "file"


cache: dict[str, dict | None] = {}


def download_image(src: str, folder: str):
    """Returns {"url", "w", "h"} or None if the file is not a valid image."""
    if not src:
        return None
    key = f"{folder}:{src}"
    if key in cache:
        return cache[key]
    url = src if src.startswith("http") else BASE + (src if src.startswith("/") else "/" + src)
    try:
        data = fetch(url)
        with Image.open(BytesIO(data)) as im:
            im.verify()
        with Image.open(BytesIO(data)) as im:
            w, h, fmt = im.width, im.height, (im.format or "").upper()
        if fmt not in {"PNG", "JPEG", "WEBP"}:
            raise ValueError(f"unsupported format {fmt}")
        # Re-encode as WebP (keeps transparency), capped at MAX_EDGE_PX on the long side.
        name = re.sub(r"\.(png|jpe?g|webp)$", "", safe_name(src), flags=re.I) + ".webp"
        dest = PUBLIC / folder / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(BytesIO(data)) as im:
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            im.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.LANCZOS)
            im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
            if folder == "products":
                (PUBLIC / "datasheet").mkdir(parents=True, exist_ok=True)
                datasheet_jpeg(im, PUBLIC / "datasheet" / (dest.stem + ".jpg"))
        cache[key] = {"url": f"/catalog/{folder}/{name}", "w": w, "h": h}
    except Exception as e:  # noqa: BLE001 — report and continue
        print(f"  ! skipped image {src}: {e}", file=sys.stderr)
        cache[key] = None
    return cache[key]


def download_pdf(src: str):
    if not src:
        return None
    url = src if src.startswith("http") else BASE + (src if src.startswith("/") else "/" + src)
    try:
        data = fetch(url)
        if not data.startswith(b"%PDF"):
            raise ValueError("not a PDF")
        name = safe_name(src)
        if not name.lower().endswith(".pdf"):
            name += ".pdf"
        dest = PUBLIC / "brochures" / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {"url": f"/catalog/brochures/{name}", "size": len(data)}
    except Exception as e:  # noqa: BLE001
        print(f"  ! skipped brochure {src}: {e}", file=sys.stderr)
        return None


def q(v) -> str:
    """SQL literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(values) -> str:
    vals = [v for v in values if v]
    return "array[" + ",".join(q(v) for v in vals) + "]::text[]" if vals else "'{}'::text[]"


def clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


# Editorial content for category landing pages (reviewed copy — edit in Admin → Categories).
CATEGORY_CONTENT = {
    "compaction-earthmoving": dict(
        overview="Compaction and earthmoving equipment prepares the ground for everything built on it. Walk-behind and ride-on rollers, plate compactors, earth compactors and tamping rammers remove air voids from soil, aggregate and asphalt so roads, slabs and foundations carry load without settling.\n\nOur range covers small walk-behind rollers for patchwork and footpaths, ride-on road rollers for larger areas, forward and reversible plate compactors for granular soils, and tamping rammers for trenches and cohesive soils — backed by service and genuine spares.",
        key_points=["Walk-behind and ride-on road rollers", "Single and double drum rollers", "Forward and reversible plate compactors", "Tamping rammers for trenches and clay", "Scarifiers for surface preparation", "Service, spares and operator guidance"],
        applications=["Road and highway works", "Paver and footpath bedding", "Trench and pipeline backfill", "Building foundations", "Parking areas and driveways", "Industrial yards"],
        guide=[("Roller or plate?", "Rollers suit larger open areas and asphalt; plate compactors suit confined areas, pavers and patchwork."), ("Soil type", "Granular soils compact best with vibration (plates, rollers); clay and silt need the impact of a tamping rammer."), ("Layer depth", "Deeper lifts need higher centrifugal force — choose reversible plates or heavier rollers for thick layers."), ("Site access", "Walk-behind machines fit narrow sites and trenches; ride-on rollers give higher output on open ground.")],
        faqs=[("Which machine is best for trenches?", "Tamping rammers and narrow plate compactors work best in trenches and around pipes."), ("Do you provide service and spares?", "Yes — commissioning, maintenance, breakdown support and genuine spares through our service network."), ("How do I get a quotation?", "Use Get Enquiry, add products to your cart, or message us on WhatsApp with your site requirement.")]),
    "concrete-consolidation": dict(
        overview="Concrete consolidation equipment removes entrapped air from freshly placed concrete so it reaches its designed strength and a dense, honeycomb-free finish. Needle (poker) vibrators, high-frequency converters and surface vibrators are used on columns, beams, slabs and precast work.",
        key_points=["Needle / poker vibrators", "High-frequency converters and pokers", "Flexible shafts and needles in multiple sizes", "Electric and engine-driven drives", "Genuine spares and accessories"],
        applications=["Columns, beams and walls", "Slabs and rafts", "Precast and bridge works", "Ready-mix and infrastructure projects"],
        guide=[("Needle diameter", "Choose needle size to suit the section and rebar spacing — smaller needles for congested reinforcement."), ("Drive type", "Electric drives suit sites with power; engine drives suit remote locations."), ("High frequency", "High-frequency pokers give faster, more uniform consolidation on large pours.")],
        faqs=[("How long should I vibrate?", "Typically 5–15 seconds per insertion, until air bubbles stop rising and the surface glistens."), ("Do you supply spare needles and shafts?", "Yes, shafts, needles and spares are available for the equipment we supply.")]),
    "concrete-finishing": dict(
        overview="Concrete finishing equipment produces flat, durable and accurately cut concrete surfaces. Power trowels float and polish slabs, screeds level fresh concrete, and groove cutters and road cutting machines cut joints and channels in concrete and asphalt.",
        key_points=["Power trowels and floaters", "Screeds and levelling equipment", "Groove cutters and road cutting machines", "Floor and joint cutting solutions", "Blades, pans and accessories"],
        applications=["Industrial and warehouse floors", "Roads and pavements", "Expansion and control joints", "Commercial and residential slabs"],
        guide=[("Trowel size", "Larger trowels give more output on big slabs; smaller trowels suit rooms and edges."), ("Cutting depth", "Blade diameter decides maximum cutting depth — match it to the joint depth required."), ("Power source", "Petrol units are portable; electric units suit indoor and enclosed work.")],
        faqs=[("When should joints be cut?", "Usually within 6–18 hours of placing, once the concrete can be cut without ravelling."), ("Do you supply blades?", "Yes, finishing blades, float pans and cutting blades are available.")]),
    "construction-access-solution": dict(
        overview="Construction access solutions provide safe working platforms at height. Suspended platforms (gondolas) are used for façade work, glazing, painting and maintenance on multi-storey buildings.",
        key_points=["Suspended working platforms", "Hoist motors with safety locks", "Modular platform lengths", "Installation support"],
        applications=["Façade and glazing works", "External painting and plastering", "Building maintenance"],
        guide=[("Platform length", "Choose platform length to suit the façade bay width and crew size."), ("Rated load", "Allow for workers, tools and materials within the rated load.")],
        faqs=[("Do you help with installation?", "Yes — our team supports installation and operator briefing.")]),
    "material-testing": dict(
        overview="Material testing and civil laboratory systems verify the quality of concrete, cement, soil and aggregates on site and in the lab. Compression testing machines and related equipment help projects meet IS standards and quality-control requirements.",
        key_points=["Compression testing machines", "Manual and electrical operation", "Equipment conforming to IS standards", "Calibration support"],
        applications=["Site quality-control labs", "Ready-mix concrete plants", "Precast yards", "Educational and testing institutes"],
        guide=[("Capacity", "Select load capacity to suit cube and cylinder sizes you test."), ("Operation", "Electrical units speed up testing; hand-operated units suit low volumes.")],
        faqs=[("Are machines calibrated?", "Machines are supplied with works calibration; third-party calibration can be arranged.")]),
    "mobile-concrete-mixing": dict(
        overview="Mobile concrete mixing equipment produces consistent concrete right where it is needed. Drum mixers and self-loading mixers reduce manual handling and give better quality control than hand mixing on small and medium projects.",
        key_points=["Drum concrete mixers", "Electric and diesel options", "Towable and wheeled designs", "Robust drums and frames"],
        applications=["Residential and commercial construction", "Rural and road works", "Small infrastructure projects"],
        guide=[("Drum capacity", "Choose capacity to match batch size and daily output."), ("Power", "Electric mixers suit sites with power; diesel mixers suit remote sites.")],
        faqs=[("What output can I expect?", "Output depends on drum capacity and cycle time — ask our team for a site estimate.")]),
    "optical-instruments": dict(
        overview="Optical survey instruments from Sokkia deliver accurate measurement for setting out, levelling and surveying. Total stations, auto levels and related instruments support construction, infrastructure and land survey work.",
        key_points=["Total stations", "Auto levels", "Accessories and tripods", "Service and calibration support"],
        applications=["Construction setting out", "Road and infrastructure survey", "Land and topographic survey"],
        guide=[("Accuracy", "Choose angular accuracy to suit your survey tolerance."), ("Range", "Consider prism and reflectorless range for your typical distances.")],
        faqs=[("Do you calibrate instruments?", "Calibration and service support can be arranged for the instruments we supply.")]),
    "portable-light-tower": dict(
        overview="Mobile lighting solutions provide bright, safe illumination for night work, road works, mining and events. Portable LED light towers deliver wide-area lighting with low fuel consumption.",
        key_points=["Portable LED light towers", "Telescopic masts", "Low fuel consumption", "Easy site movement"],
        applications=["Night-time construction", "Road works", "Mining and quarry sites", "Events and emergency response"],
        guide=[("Coverage", "Mast height and lamp output decide the area lit."), ("Run time", "Larger fuel tanks give longer unattended run time.")],
        faqs=[("How long can a light tower run?", "Run time depends on model and tank size — many LED towers run through multiple nights per tank.")]),
    "rebar-processing": dict(
        overview="Rebar processing equipment cuts, bends and shapes reinforcement steel accurately on site. Rebar bending machines, cutting machines and related equipment speed up reinforcement work and reduce wastage compared with manual methods.",
        key_points=["Rebar bending machines", "Rebar cutting machines", "Capacities for TMT bars up to 32–50 mm", "Automatic modes and planetary gearboxes", "Service and spares support"],
        applications=["Building construction", "Bridges and flyovers", "Precast yards", "Infrastructure projects"],
        guide=[("Bar diameter", "Choose machine capacity for the largest TMT bar grade and diameter you process."), ("Motor and speed", "Higher motor power and rotation speed increase daily output."), ("Mode", "Automatic machines improve repeatability on large jobs.")],
        faqs=[("Which bar grades can be processed?", "Each machine lists its rated TMT grade and maximum diameter in the specifications.")]),
    "steel-processing": dict(
        overview="Steel processing equipment handles cutting and shaping of steel sections and plates for fabrication and construction, improving speed and accuracy on site and in workshops.",
        key_points=["Steel cutting and shaping machines", "Robust industrial construction", "Service and spares support"],
        applications=["Fabrication workshops", "Structural steel works", "Construction sites"],
        guide=[("Capacity", "Match machine capacity to the section sizes you process.")],
        faqs=[("Do you provide demonstrations?", "Contact our team to arrange a demonstration.")]),
}


def main():
    print("Reading catalogue API…")
    categories, brands, products = api("categories"), api("brands"), api("products")
    print(f"  {len(categories)} categories, {len(brands)} brands, {len(products)} products")

    lines = ["-- AUTO-GENERATED by scripts/scrape-fermier-site.py from https://www.fermieragency.com — do not edit by hand.",
             "-- Real Fermier Agency catalogue. Prices are not published on the website (quotation on request);",
             "-- opening stock quantities below are SAMPLE values for the demo.",
             "",
             "-- Company contact details as published on fermieragency.com",
             "update company_settings set company_name = 'Fermier Agency', phone = '+91 44 25225128', email = 'sales@fermieragency.com',",
             "  address = 'No. 33, Sembudoss Street / No. 2, Singanna Street, Parrys, Chennai, Tamil Nadu 600001 (Opposite High Court)';",
             "",
             "-- Retire the earlier demo catalogue from public view (kept for historic demo records).",
             "update products set status = 'inactive', is_featured = false where is_sample_data;",
             "update categories set is_active = false;",
             "update brands set is_active = false;",
             ""]

    print("Downloading category images…")
    for i, c in enumerate(categories, 1):
        img = download_image(c.get("image"), "categories")
        content = CATEGORY_CONTENT.get(c["id"], {})
        types = sorted({clean(p.get("description")) for p in products if p["categoryId"] == c["id"] and clean(p.get("description"))})
        desc = clean(c.get("description")) or (", ".join(types[:6]) if types else c["name"])
        guide = json.dumps([{"title": t, "text": x} for t, x in content.get("guide", [])])
        faqs = json.dumps([{"q": t, "a": x} for t, x in content.get("faqs", [])])
        lines.append(
            "insert into categories (name, slug, description, image_url, sort_order, is_active, overview, key_points, applications, buying_guide, faqs) values ("
            f"{q(clean(c['name']))}, {q(c['id'])}, {q(desc)}, {q(img['url'] if img else None)}, {i}, true, {q(content.get('overview'))}, "
            f"{arr(content.get('key_points', []))}, {arr(content.get('applications', []))}, {q(guide)}::jsonb, {q(faqs)}::jsonb) "
            "on conflict (slug) do update set name = excluded.name, description = excluded.description, image_url = excluded.image_url, "
            "sort_order = excluded.sort_order, is_active = true, overview = excluded.overview, key_points = excluded.key_points, "
            "applications = excluded.applications, buying_guide = excluded.buying_guide, faqs = excluded.faqs;")

    print("Downloading brand logos…")
    for b in brands:
        logo = download_image(b.get("logo"), "brands")
        lines.append(
            f"insert into brands (name, slug, logo_url, is_active, description) values ({q(clean(b['name']))}, {q(b['id'].lower())}, "
            f"{q(logo['url'] if logo else None)}, true, {q(clean(b.get('description')))}) "
            "on conflict (slug) do update set name = excluded.name, logo_url = excluded.logo_url, is_active = true, description = excluded.description;")
    lines.append("")

    print("Downloading product images and brochures…")
    low_res_only, dropped, kept = [], 0, 0
    featured_cats: dict[str, int] = {}
    for n, p in enumerate(products, 1):
        sku = p["id"].upper()
        cat, brand = p["categoryId"], p["brandId"].lower()
        name, ptype = clean(p["name"]), clean(p.get("description"))
        specs = [(clean(k), clean(v)) for k, v in (p.get("specs") or {}).items() if clean(k) and clean(v)]
        features = [clean(f) for f in (p.get("features") or []) if clean(f)]
        srcs = [s for s in dict.fromkeys([p.get("image")] + list(p.get("images") or [])) if s]
        imgs = [i for i in (download_image(s, "products") for s in srcs) if i]
        hd = [i for i in imgs if min(i["w"], i["h"]) >= MIN_HD_PX]
        chosen = hd or sorted(imgs, key=lambda i: -(i["w"] * i["h"]))[:1]
        dropped += len(imgs) - len(chosen)
        kept += len(chosen)
        if imgs and not hd:
            low_res_only.append(f"{name} ({chosen[0]['w']}x{chosen[0]['h']})")
        brochure = download_pdf(p.get("brochureUrl"))

        brand_name = next((clean(b["name"]) for b in brands if b["id"].lower() == brand), brand)
        cat_name = next((clean(c["name"]) for c in categories if c["id"] == cat), cat)
        spec_text = "; ".join(f"{k}: {v}" for k, v in specs[:4])
        description = f"The {name} is a {ptype.lower() or 'machine'} from {brand_name}, part of our {cat_name} range." + (f" Key specifications — {spec_text}." if spec_text else "") \
            + " Contact our team for pricing, availability, demonstrations and after-sales support."
        featured = featured_cats.get(cat, 0) == 0 and bool(hd) and cat in {"compaction-earthmoving", "concrete-finishing", "concrete-consolidation", "mobile-concrete-mixing", "rebar-processing", "portable-light-tower"}
        if featured:
            featured_cats[cat] = 1
        stock = 2 + (n * 7) % 9  # SAMPLE opening stock

        lines.append(
            "insert into products (sku, slug, name, brand_id, manufacturer, category_id, model_number, short_description, description, unit, "
            "selling_price, tax_rate, price_visibility, reorder_threshold, is_featured, featured_rank, status, is_sample_data, features, warranty) values ("
            f"{q(sku)}, {q(p['id'].lower())}, {q(name)}, (select id from brands where slug = {q(brand)}), {q(brand_name)}, "
            f"(select id from categories where slug = {q(cat)}), {q(name)}, {q(ptype or None)}, {q(description)}, 'Nos', null, 18, 'on_request', 1, "
            f"{q(featured)}, {len(featured_cats) if featured else 100}, 'active', false, {arr(features)}, 'As per manufacturer warranty terms.') "
            "on conflict (sku) do update set name = excluded.name, brand_id = excluded.brand_id, category_id = excluded.category_id, "
            "short_description = excluded.short_description, description = excluded.description, features = excluded.features, "
            "is_featured = excluded.is_featured, featured_rank = excluded.featured_rank, status = 'active';")
        lines.append(f"delete from product_specifications where product_id = (select id from products where sku = {q(sku)});")
        rows = ([("Overview", "Type", ptype, 0)] if ptype else []) + [("Specifications", k, v, i) for i, (k, v) in enumerate(specs, 1)]
        if rows:
            lines.append("insert into product_specifications (product_id, spec_group, label, value, sort_order) select id, v.g, v.l, v.v, v.o from products, (values "
                         + ", ".join(f"({q(g)}, {q(l)}, {q(v)}, {o})" for g, l, v, o in rows)
                         + f") as v(g, l, v, o) where sku = {q(sku)};")
        lines.append(f"delete from product_images where product_id = (select id from products where sku = {q(sku)});")
        for i, img in enumerate(chosen):
            lines.append(f"insert into product_images (product_id, url, alt, sort_order) select id, {q(img['url'])}, {q(name)}, {i} from products where sku = {q(sku)};")
        if brochure:
            lines.append(f"insert into product_documents (product_id, title, storage_path, file_type, size_bytes) select id, {q(name + ' brochure')}, {q(brochure['url'])}, 'application/pdf', {brochure['size']} from products where sku = {q(sku)};")
        lines.append(
            "do $$ declare pid uuid := (select id from products where sku = " + q(sku) + "); wh uuid := (select id from warehouses where is_default); begin "
            "insert into inventory_balances(product_id, warehouse_id) values (pid, wh) on conflict do nothing; "
            "if (select on_hand from inventory_balances where product_id = pid and warehouse_id = wh) = 0 then "
            f"perform apply_inventory_movement(pid, wh, 'goods_received', {stock}, 0, 'opening_balance', null, 'OPENING', 'Sample opening stock', null); end if; end $$;")
        lines.append("")
        if n % 20 == 0:
            print(f"  {n}/{len(products)}")

    OUT_SQL.write_text("\n".join(lines) + "\n")
    print(f"\nWrote {OUT_SQL.relative_to(ROOT)}")
    print(f"Images kept: {kept}, low-resolution duplicates dropped: {dropped}")
    if low_res_only:
        print(f"{len(low_res_only)} product(s) only have low-resolution photos on the website (kept best available):")
        for x in low_res_only:
            print(f"  - {x}")


def datasheet_jpeg(im: Image.Image, dest: Path):
    """Flattened 900px JPEG for PDF datasheets (the PDF renderer can't embed WebP)."""
    ds = im.copy()
    ds.thumbnail((900, 900), Image.LANCZOS)
    if ds.mode in ("RGBA", "LA", "P"):
        ds = ds.convert("RGBA")
        bg = Image.new("RGB", ds.size, "white")
        bg.paste(ds, mask=ds.split()[3])
        ds = bg
    ds.convert("RGB").save(dest, "JPEG", quality=85, optimize=True)


def build_datasheet_images():
    """Creates the JPEG copies used by PDF datasheets from product photos already in public/catalog/products."""
    out = PUBLIC / "datasheet"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    count = 0
    for f in sorted((PUBLIC / "products").glob("*.webp")):
        with Image.open(f) as im:
            datasheet_jpeg(im, out / (f.stem + ".jpg"))
        count += 1
    print(f"Datasheet images: {count}")


SITE_IMAGES = {
    # website path -> (output file, max long edge)
    "/productPage/OUR%20PRODUCTS.webp": ("hero-banner.webp", 2400),
    "/hero2.png": ("about-trowel.webp", 1400),
    "/logo.png": ("logo-hd.png", None),
}


def build_site_images():
    """HD imagery for the public site (hero, about section, logo) from fermieragency.com."""
    out = ROOT / "public" / "site"
    out.mkdir(parents=True, exist_ok=True)
    for path, (name, edge) in SITE_IMAGES.items():
        data = fetch(BASE + path)
        with Image.open(BytesIO(data)) as im:
            im.verify()
        with Image.open(BytesIO(data)) as im:
            im = im.convert("RGBA")
            if name.endswith(".png"):
                im = im.crop(im.getbbox())  # trim transparent padding around the logo
                im.save(out / name, "PNG", optimize=True)
            else:
                im.thumbnail((edge, edge), Image.LANCZOS)
                im.save(out / name, "WEBP", quality=86, method=6)
            print(f"  {name}: {im.width}x{im.height}")


if __name__ == "__main__":
    if "--datasheets-only" in sys.argv:
        build_datasheet_images()
    elif "--site-images" in sys.argv:
        build_site_images()
    else:
        main()
