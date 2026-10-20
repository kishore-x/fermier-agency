import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

let db: PGlite;
let admin: string, manager: string, exec: string, inventory: string, custA: string, custB: string;

const one = async <T>(tx: PGlite, sql: string, params: unknown[] = []) =>
  (await tx.query<T>(sql, params)).rows[0];

async function productId(sku: string) {
  return (await one<{ id: string }>(db, "select id from products where sku = $1", [sku])).id;
}
async function balance(sku: string) {
  return one<{ on_hand: string; reserved: string }>(
    db,
    "select ib.on_hand, ib.reserved from inventory_balances ib join products p on p.id = ib.product_id where p.sku = $1",
    [sku],
  );
}

beforeAll(async () => {
  db = await createDb();
  admin = await createUser(db, "admin@test", ["admin"]);
  manager = await createUser(db, "manager@test", ["sales_manager"]);
  exec = await createUser(db, "exec@test", ["sales_executive"]);
  inventory = await createUser(db, "inv@test", ["inventory_manager"]);
  custA = await createUser(db, "a@cust", ["customer"], "CUS-DEMO-001");
  custB = await createUser(db, "b@cust", ["customer"], "CUS-DEMO-002");
}, 60_000);

describe("seed", () => {
  it("opening stock is recorded through the movement ledger", async () => {
    const b = await balance("YT-WN-500E");
    expect(Number(b.on_hand)).toBe(14);
    const m = await one<{ n: string }>(db,
      "select count(*) n from inventory_movements m join products p on p.id = m.product_id where p.sku = 'YT-WN-500E'");
    expect(Number(m.n)).toBe(1);
  });

  it("anonymous visitors see catalog without purchase cost", async () => {
    const rows = await asUser(db, null, (tx) => tx.query<Record<string, unknown>>("select * from catalog_products"));
    expect(rows.rows.length).toBe(18);
    expect(rows.rows[0]).not.toHaveProperty("purchase_cost");
    const onRequest = rows.rows.find((r) => r.sku === "YT-WN-1000")!;
    expect(onRequest.display_price).toBeNull();
    const specs = await asUser(db, null, (tx) => tx.query("select s.* from product_specifications s where s.product_id = $1", [onRequest.id]));
    expect(specs.rows.length).toBeGreaterThan(0);
    await expect(asUser(db, null, (tx) => tx.query("select purchase_cost from product_costs"))).resolves.toMatchObject({ rows: [] });
    await expect(asUser(db, null, (tx) => tx.query("select * from products"))).resolves.toMatchObject({ rows: [] });
  });
});

describe("end-to-end order workflow", () => {
  let enquiryId: string, quotationId: string, poId: string, orderId: string;

  it("customer submits an order request", async () => {
    const winch = await productId("YT-WN-500P");
    const frame = await productId("YT-MC-FR01");
    const res = await asUser(db, custA, (tx) =>
      one<{ id: string; enquiry_number: string }>(tx, "select * from submit_order_request($1, $2, $3, $4)", [
        JSON.stringify([{ product_id: winch, quantity: 4 }, { product_id: frame, quantity: 2 }]),
        "Demo site", null, "Need before monsoon",
      ]));
    enquiryId = res.id;
    expect(res.enquiry_number).toMatch(/^ENQ-\d{2}-00001$/);
    const notif = await one<{ n: string }>(db, "select count(*) n from notifications where event_type = 'order_request.new'");
    expect(Number(notif.n)).toBeGreaterThan(0);
  });

  it("customer B cannot see customer A's enquiry", async () => {
    const rows = await asUser(db, custB, (tx) => tx.query("select * from enquiries where id = $1", [enquiryId]));
    expect(rows.rows).toHaveLength(0);
  });

  it("sales executive builds a quotation; totals computed server-side", async () => {
    const winch = await productId("YT-WN-500P");
    const frame = await productId("YT-MC-FR01");
    quotationId = await asUser(db, exec, async (tx) =>
      (await one<{ save_quotation: string }>(tx, "select save_quotation(null, $1, $2)", [
        JSON.stringify({ customer_id: (await one<{ customer_id: string }>(tx, "select customer_id from enquiries where id=$1", [enquiryId])).customer_id,
          enquiry_id: enquiryId, shipping_charges: "1500.00", payment_terms: "Net 30" }),
        JSON.stringify([
          { product_id: winch, quantity: 4, unit_price: "62500.00", discount_pct: "5" },
          { product_id: frame, quantity: 2, unit_price: "27500.00", discount_pct: "0" },
        ]),
      ])).save_quotation);
    const q = await one<Record<string, string>>(db, "select * from quotations where id = $1", [quotationId]);
    // 4*62500 = 250000, 5% = 12500 → 237500, tax 18% = 42750
    // 2*27500 = 55000, tax 9900
    expect(q.subtotal).toBe("305000.00");
    expect(q.discount_total).toBe("12500.00");
    expect(q.tax_total).toBe("52650.00");
    expect(q.grand_total).toBe("346650.00");
    expect(q.requires_approval).toBe(false);
  });

  it("customer cannot see draft quotations", async () => {
    const r = await asUser(db, custA, (tx) => tx.query("select * from quotations where id=$1", [quotationId]));
    expect(r.rows).toHaveLength(0);
  });

  it("quotation is approved, sent, accepted by customer", async () => {
    await asUser(db, exec, (tx) => tx.query("select transition_quotation($1, 'submit')", [quotationId]));
    await asUser(db, exec, (tx) => tx.query("select transition_quotation($1, 'mark_sent')", [quotationId]));
    const r = await asUser(db, custA, (tx) =>
      one<{ customer_respond_quotation: string }>(tx, "select customer_respond_quotation($1, true)", [quotationId]));
    expect(r.customer_respond_quotation).toBe("accepted");
    const v = await one<{ n: string }>(db, "select count(*) n from quotation_versions where quotation_id = $1", [quotationId]);
    expect(Number(v.n)).toBeGreaterThanOrEqual(1);
  });

  it("accepted quotation can no longer be edited", async () => {
    await expect(asUser(db, exec, (tx) =>
      tx.query("update quotations set grand_total = 1 where id = $1", [quotationId]))).rejects.toThrow(/cannot be changed/);
  });

  it("PO with wrong amount is flagged, not silently accepted", async () => {
    const badPo = await asUser(db, custA, async (tx) =>
      (await one<{ register_customer_po: string }>(tx,
        "select register_customer_po($1, 'PO-WRONG', current_date, 300000, 'po/x.pdf', 'x.pdf', null)", [quotationId])).register_customer_po);
    const issues = await asUser(db, manager, (tx) =>
      one<{ verify_customer_po: string[] }>(tx, "select verify_customer_po($1, null)", [badPo]));
    expect(issues.verify_customer_po.length).toBeGreaterThan(0);
    const st = await one<{ status: string }>(db, "select status from customer_purchase_orders where id=$1", [badPo]);
    expect(st.status).toBe("requires_correction");
    await expect(asUser(db, manager, (tx) => tx.query("select convert_quotation_to_order($1, $2)", [quotationId, badPo])))
      .rejects.toThrow(/must be verified/);
  });

  it("matching PO verifies and converts to a sales order (idempotent)", async () => {
    poId = await asUser(db, custA, async (tx) =>
      (await one<{ register_customer_po: string }>(tx,
        "select register_customer_po($1, 'PO-OK-1', current_date, 346650.00, 'po/ok.pdf', 'ok.pdf', null)", [quotationId])).register_customer_po);
    const issues = await asUser(db, manager, (tx) => one<{ verify_customer_po: string[] }>(tx, "select verify_customer_po($1, null)", [poId]));
    expect(issues.verify_customer_po).toEqual([]);

    await expect(asUser(db, exec, (tx) => tx.query("select convert_quotation_to_order($1, $2)", [quotationId, poId])))
      .rejects.toThrow(/FORBIDDEN/);
    orderId = await asUser(db, manager, async (tx) =>
      (await one<{ convert_quotation_to_order: string }>(tx, "select convert_quotation_to_order($1, $2)", [quotationId, poId])).convert_quotation_to_order);
    const again = await asUser(db, manager, async (tx) =>
      (await one<{ convert_quotation_to_order: string }>(tx, "select convert_quotation_to_order($1, $2)", [quotationId, poId])).convert_quotation_to_order);
    expect(again).toBe(orderId);
    const so = await one<{ grand_total: string; n: string }>(db,
      "select grand_total, (select count(*) from sales_orders) n from sales_orders where id=$1", [orderId]);
    expect(so.grand_total).toBe("346650.00");
    expect(Number(so.n)).toBe(1);
  });

  it("verified PO cannot be replaced", async () => {
    await expect(db.query("update customer_purchase_orders set storage_path = 'po/other.pdf' where id = $1", [poId]))
      .rejects.toThrow(/cannot be modified/);
  });

  it("confirmed order prices are frozen", async () => {
    await expect(db.query("update sales_order_items set unit_price = 1 where sales_order_id = $1", [orderId]))
      .rejects.toThrow(/cannot be changed/);
  });

  it("reserving stock reduces available but not on-hand", async () => {
    await asUser(db, inventory, (tx) => tx.query("select reserve_order_stock($1)", [orderId]));
    const b = await balance("YT-WN-500P");
    expect(Number(b.on_hand)).toBe(9);
    expect(Number(b.reserved)).toBe(4);
    const cat = await asUser(db, null, (tx) => one<{ available_qty: string }>(tx,
      "select available_qty from catalog_products where sku = 'YT-WN-500P'"));
    expect(Number(cat.available_qty)).toBe(5);
  });

  it("partial dispatch then full dispatch updates stock and status", async () => {
    const items = (await db.query<{ id: string; sku_snapshot: string }>(
      "select id, sku_snapshot from sales_order_items where sales_order_id = $1 order by sort_order", [orderId])).rows;
    const winchLine = items.find((i) => i.sku_snapshot === "YT-WN-500P")!;
    const frameLine = items.find((i) => i.sku_snapshot === "YT-MC-FR01")!;

    await expect(asUser(db, exec, (tx) => tx.query("select dispatch_order($1, $2, null, null, null, null)",
      [orderId, JSON.stringify([{ item_id: winchLine.id, quantity: 1 }])]))).rejects.toThrow(/FORBIDDEN/);

    await asUser(db, inventory, (tx) => tx.query("select dispatch_order($1, $2, 'Truck', 'LR-001', null, null)",
      [orderId, JSON.stringify([{ item_id: winchLine.id, quantity: 2 }])]));
    let so = await one<{ status: string }>(db, "select status from sales_orders where id=$1", [orderId]);
    expect(so.status).toBe("partially_fulfilled");
    let b = await balance("YT-WN-500P");
    expect([Number(b.on_hand), Number(b.reserved)]).toEqual([7, 2]);

    await expect(asUser(db, inventory, (tx) => tx.query("select dispatch_order($1, $2, null, null, null, null)",
      [orderId, JSON.stringify([{ item_id: winchLine.id, quantity: 5 }])]))).rejects.toThrow(/more than ordered/);

    await asUser(db, inventory, (tx) => tx.query("select dispatch_order($1, $2, 'Truck', 'LR-002', null, null)",
      [orderId, JSON.stringify([{ item_id: winchLine.id, quantity: 2 }, { item_id: frameLine.id, quantity: 2 }])]));
    so = await one<{ status: string }>(db, "select status from sales_orders where id=$1", [orderId]);
    expect(so.status).toBe("dispatched");
    b = await balance("YT-WN-500P");
    expect([Number(b.on_hand), Number(b.reserved)]).toEqual([5, 0]);
  });
});

describe("stock safety", () => {
  async function orderFor(sku: string, qty: number) {
    const pid = await productId(sku);
    const cust = (await one<{ id: string }>(db, "select id from customers where customer_code='CUS-DEMO-002'")).id;
    const qid = await asUser(db, admin, async (tx) => (await one<{ save_quotation: string }>(tx,
      "select save_quotation(null, $1, $2)", [JSON.stringify({ customer_id: cust }),
        JSON.stringify([{ product_id: pid, quantity: qty }])])).save_quotation);
    const q = await one<{ grand_total: string }>(db, "select grand_total from quotations where id=$1", [qid]);
    await asUser(db, admin, async (tx) => {
      await tx.query("select transition_quotation($1,'submit')", [qid]);
      const st = await one<{ status: string }>(tx, "select status from quotations where id=$1", [qid]);
      if (st.status === "pending_approval") await tx.query("select transition_quotation($1,'approve')", [qid]);
      await tx.query("select transition_quotation($1,'mark_sent')", [qid]);
      await tx.query("select transition_quotation($1,'accept')", [qid]);
    });
    const po = await asUser(db, admin, async (tx) => (await one<{ register_customer_po: string }>(tx,
      "select register_customer_po($1, $2, current_date, $3, 'po/a.pdf', 'a.pdf', null)", [qid, `PO-${qid.slice(0, 8)}`, q.grand_total])).register_customer_po);
    return asUser(db, admin, async (tx) => {
      await tx.query("select verify_customer_po($1, null)", [po]);
      return (await one<{ convert_quotation_to_order: string }>(tx, "select convert_quotation_to_order($1,$2)", [qid, po])).convert_quotation_to_order;
    });
  }

  it("cannot reserve more than available (no overselling)", async () => {
    const o1 = await orderFor("AK-FG-TH", 1); // stock 1
    const o2 = await orderFor("AK-FG-TH", 1);
    await asUser(db, admin, (tx) => tx.query("select reserve_order_stock($1)", [o1]));
    await expect(asUser(db, admin, (tx) => tx.query("select reserve_order_stock($1)", [o2]))).rejects.toThrow(/INSUFFICIENT_STOCK/);
    const st = await one<{ status: string }>(db, "select status from sales_orders where id=$1", [o2]);
    expect(st.status).toBe("confirmed");
  });

  it("cancelling an order releases its reservation", async () => {
    const o = await orderFor("AT-AC-100L", 3);
    await asUser(db, admin, (tx) => tx.query("select reserve_order_stock($1)", [o]));
    expect(Number((await balance("AT-AC-100L")).reserved)).toBe(3);
    await asUser(db, manager, (tx) => tx.query("select cancel_sales_order($1, 'Customer withdrew')", [o]));
    const b = await balance("AT-AC-100L");
    expect([Number(b.on_hand), Number(b.reserved)]).toEqual([11, 0]);
    const rel = await one<{ n: string }>(db,
      "select count(*) n from inventory_movements where reference_id = $1 and movement_type = 'reservation_release'", [o]);
    expect(Number(rel.n)).toBe(1);
  });

  it("manual adjustment cannot drive stock negative and requires a reason", async () => {
    const pid = await productId("AK-BC-52");
    await expect(asUser(db, inventory, (tx) => tx.query("select record_stock_movement($1,'adjustment',-5,'damaged',null)", [pid])))
      .rejects.toThrow(/INSUFFICIENT_STOCK/);
    await expect(asUser(db, inventory, (tx) => tx.query("select record_stock_movement($1,'adjustment',-1,'',null)", [pid])))
      .rejects.toThrow(/reason/);
    await expect(asUser(db, exec, (tx) => tx.query("select record_stock_movement($1,'goods_received',5,null,null)", [pid])))
      .rejects.toThrow(/FORBIDDEN/);
  });

  it("users cannot write inventory balances directly", async () => {
    await asUser(db, inventory, (tx) => tx.query("update inventory_balances set on_hand = 999"));
    expect(Number((await balance("AK-BC-52")).on_hand)).toBe(2);
  });

  it("large discounts require manager approval", async () => {
    const pid = await productId("PM-AG-4");
    const cust = (await one<{ id: string }>(db, "select id from customers where customer_code='CUS-DEMO-003'")).id;
    const qid = await asUser(db, exec, async (tx) => (await one<{ save_quotation: string }>(tx,
      "select save_quotation(null, $1, $2)", [JSON.stringify({ customer_id: cust }),
        JSON.stringify([{ product_id: pid, quantity: 2, discount_pct: 25 }])])).save_quotation);
    const st = await asUser(db, exec, async (tx) =>
      (await one<{ transition_quotation: string }>(tx, "select transition_quotation($1,'submit')", [qid])).transition_quotation);
    expect(st).toBe("pending_approval");
    await expect(asUser(db, exec, (tx) => tx.query("select transition_quotation($1,'approve')", [qid]))).rejects.toThrow(/FORBIDDEN/);
    await asUser(db, manager, (tx) => tx.query("select transition_quotation($1,'approve')", [qid]));
  });

  it("customers cannot read audit logs or other customers", async () => {
    const r = await asUser(db, custA, (tx) => tx.query("select * from customers"));
    expect(r.rows).toHaveLength(1);
    const a = await asUser(db, custA, (tx) => tx.query("select * from audit_logs"));
    expect(a.rows).toHaveLength(0);
  });
});

describe("cost visibility and reports", () => {
  it("only cost-authorized roles can read purchase cost", async () => {
    const asExec = await asUser(db, exec, (tx) => tx.query("select * from product_costs"));
    expect(asExec.rows).toHaveLength(0);
    const asInv = await asUser(db, inventory, (tx) => tx.query("select * from product_costs"));
    expect(asInv.rows.length).toBe(18);
  });

  it("dashboard hides stock value from sales roles", async () => {
    const m1 = await asUser(db, exec, (tx) => one<{ dashboard_metrics: Record<string, unknown> }>(tx, "select dashboard_metrics()"));
    expect(m1.dashboard_metrics.stock_value).toBeNull();
    const m2 = await asUser(db, admin, (tx) => one<{ dashboard_metrics: Record<string, unknown> }>(tx, "select dashboard_metrics()"));
    expect(Number(m2.dashboard_metrics.stock_value)).toBeGreaterThan(0);
    await expect(asUser(db, custA, (tx) => tx.query("select dashboard_metrics()"))).rejects.toThrow(/FORBIDDEN/);
  });

  it("sales report sums confirmed orders and excludes cancelled", async () => {
    const r = await asUser(db, manager, (tx) =>
      tx.query<{ label: string; revenue: string }>("select * from report_sales(current_date - 30, current_date, 'customer')"));
    const a = r.rows.find((x) => x.label.startsWith("Sample Builders"))!;
    expect(a.revenue).toBe("346650.00");
    await expect(asUser(db, exec, (tx) => tx.query("select * from report_sales(current_date - 30, current_date, 'customer')")))
      .rejects.toThrow(/FORBIDDEN/);
  });
});

describe("product master", () => {
  it("save_product writes product, cost and specs atomically; duplicate SKU rejected", async () => {
    const cat = (await one<{ id: string }>(db, "select id from categories where slug='power-tools'")).id;
    const id = await asUser(db, admin, async (tx) => (await one<{ save_product: string }>(tx,
      "select save_product(null, $1, $2, 999.50, true)", [JSON.stringify({ sku: "test-drill", slug: "test-drill", name: "Test Drill",
        category_id: cat, selling_price: "1500", status: "active", price_visibility: "show_price" }),
      JSON.stringify([{ spec_group: "Motor", label: "Power", value: "600 W" }, { label: "", value: "skip" }])])).save_product);
    const specs = await db.query("select * from product_specifications where product_id = $1", [id]);
    expect(specs.rows).toHaveLength(1);
    expect((await one<{ purchase_cost: string }>(db, "select purchase_cost from product_costs where product_id=$1", [id])).purchase_cost).toBe("999.50");
    await expect(asUser(db, admin, (tx) => tx.query("select save_product(null, $1, null, null, false)",
      [JSON.stringify({ sku: "TEST-DRILL", slug: "x2", name: "Dup", category_id: cat })]))).rejects.toThrow(/duplicate|unique/i);
    await expect(asUser(db, exec, (tx) => tx.query("select save_product(null, $1, null, null, false)",
      [JSON.stringify({ sku: "Z", slug: "z", name: "Z" })]))).rejects.toThrow(/FORBIDDEN/);
  });

  it("CSV import is all-or-nothing", async () => {
    const before = Number((await one<{ n: string }>(db, "select count(*) n from products")).n);
    await expect(asUser(db, admin, (tx) => tx.query("select import_products($1, 'create_only')", [JSON.stringify([
      { sku: "IMP-1", name: "Imported One", category_slug: "generators", opening_stock: "5" },
      { sku: "IMP-2", name: "Imported Two", category_slug: "no-such-category" },
    ])]))).rejects.toThrow(/unknown category/);
    expect(Number((await one<{ n: string }>(db, "select count(*) n from products")).n)).toBe(before);
    const res = await asUser(db, admin, (tx) => one<{ import_products: { created: number } }>(tx, "select import_products($1, 'create_only')", [JSON.stringify([
      { sku: "IMP-1", name: "Imported One", category_slug: "generators", opening_stock: "5", brand_name: "NewBrand" },
    ])]));
    expect(res.import_products.created).toBe(1);
    expect(Number((await balance("IMP-1")).on_hand)).toBe(5);
  });
});

describe("sales executive scope", () => {
  it("can update only assigned customers", async () => {
    const c3 = (await one<{ id: string }>(db, "select id from customers where customer_code='CUS-DEMO-003'")).id;
    await asUser(db, exec, (tx) => tx.query("update customers set phone = 'x' where id = $1", [c3]));
    expect((await one<{ phone: string }>(db, "select phone from customers where id=$1", [c3])).phone).not.toBe("x");
    await db.query("update customers set salesperson_id = $1 where id = $2", [exec, c3]);
    await asUser(db, exec, (tx) => tx.query("update customers set phone = 'y' where id = $1", [c3]));
    expect((await one<{ phone: string }>(db, "select phone from customers where id=$1", [c3])).phone).toBe("y");
  });
});

describe("profile privilege guard", () => {
  it("staff cannot raise their own discount limit", async () => {
    await expect(asUser(db, exec, (tx) => tx.query("update profiles set discount_limit_pct = 90 where id = $1", [exec]))).rejects.toThrow(/FORBIDDEN/);
    await asUser(db, exec, (tx) => tx.query("update profiles set full_name = 'Exec Renamed' where id = $1", [exec]));
    await asUser(db, admin, (tx) => tx.query("update profiles set discount_limit_pct = 15 where id = $1", [exec]));
  });

  it("delivery confirmation completes the order lifecycle", async () => {
    const so = (await one<{ id: string }>(db, "select id from sales_orders where status = 'dispatched' limit 1")).id;
    const ds = (await db.query<{ id: string }>("select id from dispatches where sales_order_id = $1", [so])).rows;
    for (const d of ds) await asUser(db, inventory, (tx) => tx.query("select confirm_delivery($1, 'POD ok')", [d.id]));
    expect((await one<{ status: string }>(db, "select status from sales_orders where id=$1", [so])).status).toBe("delivered");
    await asUser(db, manager, (tx) => tx.query("select complete_sales_order($1)", [so]));
    const n = await one<{ n: string }>(db, "select count(*) n from notifications where event_type = 'sales_order.delivered'");
    expect(Number(n.n)).toBeGreaterThan(0);
  });
});
