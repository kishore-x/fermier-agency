import "server-only";
import type { Transaction } from "@electric-sql/pglite";
import { type Ctx, withContext } from "./db";

type Meta = Parameters<Parameters<typeof withContext>[1]>[1];
export type PgError = { message: string; code: string; details?: string | null; hint?: string | null };
export type Result<T = unknown> = { data: T | null; error: PgError | null; count: number | null; status: number };

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (id: string) => {
  if (!IDENT.test(id)) throw new Error(`Invalid identifier: ${id}`);
  return `"${id}"`;
};

// ---------- select parsing ----------
type Item =
  | { kind: "star" }
  | { kind: "col"; name: string; alias: string }
  | { kind: "embed"; rel: string; hint?: string; alias: string; items: Item[]; count: boolean };

function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(s: string): Item[] {
  return splitTop(s.replace(/\s+/g, " ")).map((tok) => {
    if (tok === "*") return { kind: "star" } as Item;
    const paren = tok.indexOf("(");
    const head = paren >= 0 ? tok.slice(0, paren) : tok;
    const [alias, body] = head.includes(":") ? head.split(":") : [null, head];
    if (paren < 0) return { kind: "col", name: body.trim(), alias: (alias ?? body).trim() } as Item;
    const [rel, hint] = body.trim().split("!");
    const inner = tok.slice(paren + 1, tok.lastIndexOf(")")).trim();
    return { kind: "embed", rel, hint, alias: (alias ?? rel).trim(), items: inner === "count" ? [] : parseSelect(inner), count: inner === "count" } as Item;
  });
}

// ---------- filters ----------
type Filter = { col: string; op: string; value: unknown } | { or: Filter[] };

class Params {
  values: unknown[] = [];
  add(v: unknown) {
    this.values.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
    return `$${this.values.length}`;
  }
}

function filterSql(f: Filter, alias: string, p: Params): string {
  if ("or" in f) return `(${f.or.map((x) => filterSql(x, alias, p)).join(" or ")})`;
  const c = `${alias}.${q(f.col)}`;
  switch (f.op) {
    case "eq": return `${c} = ${p.add(f.value)}`;
    case "neq": return `${c} is distinct from ${p.add(f.value)}`;
    case "gt": return `${c} > ${p.add(f.value)}`;
    case "gte": return `${c} >= ${p.add(f.value)}`;
    case "lt": return `${c} < ${p.add(f.value)}`;
    case "lte": return `${c} <= ${p.add(f.value)}`;
    case "ilike": return `${c}::text ilike ${p.add(f.value)}`;
    case "like": return `${c}::text like ${p.add(f.value)}`;
    case "is": return f.value === null || f.value === "null" ? `${c} is null` : `${c} is ${f.value === true || f.value === "true" ? "true" : "false"}`;
    case "in": {
      const arr = f.value as unknown[];
      return arr.length ? `${c} in (${arr.map((v) => p.add(v)).join(",")})` : "false";
    }
    default: throw new Error(`Unsupported filter ${f.op}`);
  }
}

function parseOr(expr: string): Filter {
  return {
    or: splitTop(expr).map((part) => {
      const [col, op, ...rest] = part.split(".");
      const raw = rest.join(".");
      return { col, op, value: raw === "null" ? null : raw };
    }),
  };
}

// ---------- SQL building ----------
type Order = { col: string; asc: boolean; nullsFirst?: boolean };
type EmbedOpts = Record<string, { order: Order[]; limit?: number }>;

function resolveRel(meta: Meta, table: string, rel: string, hint?: string) {
  const match = (fk: Meta["fks"][number]) => !hint || fk.name === hint || fk.cols.includes(hint);
  const m2o = meta.fks.find((fk) => fk.table === table && fk.ftable === rel && match(fk));
  if (m2o) return { many: false, child: table, parent: rel, cols: m2o.cols, fcols: m2o.fcols };
  const o2m = meta.fks.find((fk) => fk.table === rel && fk.ftable === table && match(fk));
  if (o2m) return { many: true, child: rel, parent: table, cols: o2m.cols, fcols: o2m.fcols };
  throw new Error(`No relationship between ${table} and ${rel}${hint ? ` (${hint})` : ""}`);
}

let aliasSeq = 0;
function rowExpr(meta: Meta, table: string, alias: string, items: Item[], embeds: EmbedOpts, path: string): string {
  const parts: string[] = [];
  const cols: string[] = [];
  for (const it of items) {
    if (it.kind === "star") parts.push(`to_jsonb(${alias})`);
    else if (it.kind === "col") cols.push(`'${it.alias}', ${alias}.${q(it.name)}`);
    else {
      const r = resolveRel(meta, table, it.rel, it.hint);
      const a = `t${++aliasSeq}`;
      const key = path ? `${path}.${it.rel}` : it.rel;
      const join = r.many
        ? r.cols.map((c, i) => `${a}.${q(c)} = ${alias}.${q(r.fcols[i])}`).join(" and ")
        : r.cols.map((c, i) => `${a}.${q(r.fcols[i])} = ${alias}.${q(c)}`).join(" and ");
      const target = r.many ? r.child : r.parent;
      let sub: string;
      if (it.count) {
        sub = `jsonb_build_array(jsonb_build_object('count', (select count(*) from public.${q(target)} ${a} where ${join})))`;
      } else if (r.many) {
        const o = embeds[key];
        const ord = o?.order.length ? ` order by ${o.order.map((x) => orderSql(a, x)).join(", ")}` : "";
        const lim = o?.limit ? ` limit ${Number(o.limit)}` : "";
        const inner = rowExpr(meta, target, a, it.items, embeds, key);
        sub = `coalesce((select jsonb_agg(${inner}) from (select * from public.${q(target)} ${a} where ${join}${ord}${lim}) ${a}), '[]'::jsonb)`;
      } else {
        sub = `(select ${rowExpr(meta, target, a, it.items, embeds, key)} from public.${q(target)} ${a} where ${join} limit 1)`;
      }
      cols.push(`'${it.alias}', ${sub}`);
    }
  }
  if (cols.length) parts.push(`jsonb_build_object(${cols.join(", ")})`);
  return parts.length ? parts.join(" || ") : "'{}'::jsonb";
}

const orderSql = (alias: string, o: Order) =>
  `${alias}.${q(o.col)} ${o.asc ? "asc" : "desc"}${o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last"}`;

const toError = (e: unknown): PgError => {
  const x = e as { message?: string; code?: string; detail?: string; hint?: string };
  return { message: x.message ?? String(e), code: x.code ?? "PGRST000", details: x.detail ?? null, hint: x.hint ?? null };
};

// ---------- builder ----------
type Mode = "select" | "insert" | "update" | "upsert" | "delete";

export class QueryBuilder<T = unknown> implements PromiseLike<Result<T>> {
  private mode: Mode = "select";
  private selectStr: string | null = null;
  private countMode: "exact" | null = null;
  private head = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private embeds: EmbedOpts = {};
  private rangeFrom?: number;
  private rangeTo?: number;
  private limitN?: number;
  private singleMode: "one" | "maybe" | null = null;
  private payload: Record<string, unknown>[] = [];
  private onConflict?: string;
  private ignoreDuplicates = false;

  constructor(private ctx: Ctx, private table: string, private skipReady = false) {}

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.selectStr = cols;
    if (opts?.count) this.countMode = "exact";
    if (opts?.head) this.head = true;
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.mode = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert"; this.payload = Array.isArray(rows) ? rows : [rows];
    this.onConflict = opts?.onConflict; this.ignoreDuplicates = !!opts?.ignoreDuplicates; return this;
  }
  update(values: Record<string, unknown>) { this.mode = "update"; this.payload = [values]; return this; }
  delete() { this.mode = "delete"; return this; }

  eq(col: string, value: unknown) { this.filters.push({ col, op: "eq", value }); return this; }
  neq(col: string, value: unknown) { this.filters.push({ col, op: "neq", value }); return this; }
  gt(col: string, value: unknown) { this.filters.push({ col, op: "gt", value }); return this; }
  gte(col: string, value: unknown) { this.filters.push({ col, op: "gte", value }); return this; }
  lt(col: string, value: unknown) { this.filters.push({ col, op: "lt", value }); return this; }
  lte(col: string, value: unknown) { this.filters.push({ col, op: "lte", value }); return this; }
  ilike(col: string, value: string) { this.filters.push({ col, op: "ilike", value }); return this; }
  like(col: string, value: string) { this.filters.push({ col, op: "like", value }); return this; }
  is(col: string, value: null | boolean) { this.filters.push({ col, op: "is", value }); return this; }
  in(col: string, values: unknown[]) { this.filters.push({ col, op: "in", value: values }); return this; }
  or(expr: string) { this.filters.push(parseOr(expr)); return this; }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string; foreignTable?: string }) {
    const o = { col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst };
    const ref = opts?.referencedTable ?? opts?.foreignTable;
    if (ref) (this.embeds[ref] ??= { order: [] }).order.push(o); else this.orders.push(o);
    return this;
  }
  limit(n: number, opts?: { referencedTable?: string; foreignTable?: string }) {
    const ref = opts?.referencedTable ?? opts?.foreignTable;
    if (ref) (this.embeds[ref] ??= { order: [] }).limit = n; else this.limitN = n;
    return this;
  }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }

  then<R1 = Result<T>, R2 = never>(ok?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null, err?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    return this.execute().then(ok, err);
  }

  private where(alias: string, p: Params) {
    return this.filters.length ? ` where ${this.filters.map((f) => filterSql(f, alias, p)).join(" and ")}` : "";
  }

  private async execute(): Promise<Result<T>> {
    try {
      return await withContext(this.ctx, (tx, meta) => this.run(tx, meta), { skipReady: this.skipReady });
    } catch (e) {
      const error = toError(e);
      console.warn(`[local-db] ${this.mode} ${this.table}: ${error.message}`);
      return { data: null, error, count: null, status: 400 };
    }
  }

  private async run(tx: Transaction, meta: Meta): Promise<Result<T>> {
    const p = new Params();
    const t = `public.${q(this.table)}`;
    if (this.mode === "select") {
      const where = this.where("a0", p);
      let count: number | null = null;
      if (this.countMode) {
        const r = await tx.query<{ n: number }>(`select count(*)::int as n from ${t} a0${where}`, p.values);
        count = r.rows[0].n;
      }
      if (this.head) return { data: null, error: null, count, status: 200 };
      const expr = rowExpr(meta, this.table, "a0", parseSelect(this.selectStr ?? "*"), this.embeds, "");
      const ord = this.orders.length ? ` order by ${this.orders.map((o) => orderSql("a0", o)).join(", ")}` : "";
      let lim = "";
      if (this.rangeFrom !== undefined) lim = ` limit ${this.rangeTo! - this.rangeFrom + 1} offset ${this.rangeFrom}`;
      else if (this.limitN !== undefined) lim = ` limit ${this.limitN}`;
      const r = await tx.query<{ j: unknown }>(`select ${expr} as j from ${t} a0${where}${ord}${lim}`, p.values);
      return this.shape(r.rows.map((x) => x.j), count);
    }

    let sql: string;
    if (this.mode === "delete") {
      sql = `delete from ${t} a0${this.where("a0", p)} returning a0.*`;
    } else if (this.mode === "update") {
      const vals = this.payload[0];
      const sets = Object.keys(vals).map((k) => `${q(k)} = ${p.add(vals[k])}`).join(", ");
      sql = `update ${t} a0 set ${sets}${this.where("a0", p)} returning a0.*`;
    } else {
      const cols = [...new Set(this.payload.flatMap((r) => Object.keys(r)))];
      const values = this.payload.map((r) => `(${cols.map((c) => (c in r && r[c] !== undefined ? p.add(r[c]) : "default")).join(", ")})`).join(", ");
      sql = `insert into ${t} as a0 (${cols.map(q).join(", ")}) values ${values}`;
      if (this.mode === "upsert") {
        const target = this.onConflict ? this.onConflict.split(",").map((s) => s.trim()) : meta.pks[this.table] ?? ["id"];
        const updates = cols.filter((c) => !target.includes(c));
        sql += ` on conflict (${target.map(q).join(", ")}) ` + (this.ignoreDuplicates || !updates.length ? "do nothing" : `do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`);
      }
      sql += " returning a0.*";
    }
    const r = await tx.query<{ j: unknown }>(`with m as (${sql}) select to_jsonb(m) as j from m`, p.values);
    if (this.selectStr === null) return { data: null, error: null, count: null, status: 201 };
    return this.shape(r.rows.map((x) => x.j), null);
  }

  private shape(rows: unknown[], count: number | null): Result<T> {
    if (this.singleMode) {
      if (rows.length > 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count, status: 406 };
      if (!rows.length) {
        return this.singleMode === "maybe"
          ? { data: null, error: null, count, status: 200 }
          : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count, status: 406 };
      }
      return { data: rows[0] as T, error: null, count, status: 200 };
    }
    return { data: rows as T, error: null, count, status: 200 };
  }
}


function pgArray(v: unknown[]) {
  return `{${v.map((x) => (x === null ? "NULL" : `"${String(x).replace(/["\\]/g, "\\$&")}"`)).join(",")}}`;
}

export async function callRpc(ctx: Ctx, fn: string, args: Record<string, unknown> = {}, skipReady = false): Promise<Result> {
  try {
    return await withContext(ctx, async (tx, meta) => {
      const def = meta.fns[fn];
      if (!def) throw Object.assign(new Error(`Function ${fn} not found`), { code: "PGRST202" });
      const p = new Params();
      const named = Object.entries(args).map(([k, v]) => {
        const type = def.args[k] ?? "";
        const val = Array.isArray(v) && type.endsWith("[]") ? pgArray(v) : v;
        return `${q(k)} => ${p.add(val)}${type ? `::${type}` : ""}`;
      }).join(", ");
      const call = `public.${q(fn)}(${named})`;
      if (def.rettype === "void") { await tx.query(`select ${call}`, p.values); return { data: null, error: null, count: null, status: 204 }; }
      const sql = def.retset ? `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as j from ${call} x` : `select to_jsonb(${call}) as j`;
      const r = await tx.query<{ j: unknown }>(sql, p.values);
      return { data: r.rows[0]?.j ?? null, error: null, count: null, status: 200 };
    }, { skipReady });
  } catch (e) {
    const error = toError(e);
    console.warn(`[local-db] rpc ${fn}: ${error.message}`);
    return { data: null, error, count: null, status: 400 };
  }
}
