import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";

let db: PGlite;
beforeAll(async () => { db = await createDb({ realCatalog: true }); }, 120_000);

describe("real Fermier Agency catalogue seed", () => {
  it("publishes exactly the imported catalogue to visitors", async () => {
    const r = await asUser(db, null, (tx) => tx.query<{ n: number; cats: number; samples: number }>(
      "select count(*)::int n, count(distinct category_slug)::int cats, count(*) filter (where is_sample_data)::int samples from catalog_products"));
    expect(r.rows[0]).toEqual({ n: 124, cats: 10, samples: 0 });
  });

  it("every product has specs and at least one image visible to anonymous visitors", async () => {
    const r = await asUser(db, null, (tx) => tx.query<{ no_img: number; no_spec: number }>(`
      select count(*) filter (where image_url is null)::int no_img,
             count(*) filter (where not exists (select 1 from product_specifications s where s.product_id = c.id))::int no_spec
      from catalog_products c`));
    expect(r.rows[0].no_img).toBe(0);
    expect(r.rows[0].no_spec).toBe(0);
  });

  it("imports DDR20 G with its full specification sheet", async () => {
    const r = await asUser(db, null, (tx) => tx.query<{ label: string; value: string }>(
      "select s.label, s.value from product_specifications s join catalog_products p on p.id = s.product_id where p.sku = 'DDR20-G' order by s.sort_order"));
    expect(r.rows.find((x) => x.label === "Centrifugal Force")?.value).toBe("20 KN");
    expect(r.rows.find((x) => x.label === "Machine Weight")?.value).toBe("580 kgs");
    expect(r.rows.length).toBeGreaterThanOrEqual(15);
  });

  it("only the real categories and brands are active", async () => {
    const c = await asUser(db, null, (tx) => tx.query<{ slug: string }>("select slug from categories where is_active order by sort_order"));
    expect(c.rows.map((x) => x.slug)).toContain("compaction-earthmoving");
    expect(c.rows).toHaveLength(10);
    const b = await asUser(db, null, (tx) => tx.query<{ name: string }>("select name from brands where is_active order by name"));
    expect(b.rows.map((x) => x.name)).toEqual(expect.arrayContaining(["STROKE", "Sokkia", "Greaves Cotton"]));
    expect(b.rows).toHaveLength(6);
  });
});
