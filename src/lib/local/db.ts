import "server-only";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Local mock backend: an embedded Postgres running the real migrations, RLS policies and functions.
export const DATA_DIR = join(process.cwd(), ".data");

const PLATFORM_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique not null, encrypted_password text,
  raw_user_meta_data jsonb not null default '{}', banned_until timestamptz, created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null,
  owner uuid, mimetype text, size bigint, created_at timestamptz default now(), unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

type Meta = {
  fks: { name: string; table: string; cols: string[]; ftable: string; fcols: string[] }[];
  pks: Record<string, string[]>;
  fns: Record<string, { retset: boolean; rettype: string; args: Record<string, string> }>;
};

type State = { db: PGlite; meta: Meta; ready: Promise<void>; queue: Promise<unknown> };
const g = globalThis as unknown as { __fermierLocal?: State };

async function loadMeta(db: PGlite): Promise<Meta> {
  const fks = await db.query<{ name: string; table: string; cols: string[]; ftable: string; fcols: string[] }>(`
    select c.conname as name, cl.relname as "table", array_agg(a.attname::text order by k.ord) as cols,
           rcl.relname as ftable, array_agg(fa.attname::text order by k.ord) as fcols
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_class rcl on rcl.oid = c.confrelid
    cross join lateral unnest(c.conkey, c.confkey) with ordinality k(attnum, fattnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = k.fattnum
    where c.contype = 'f' and n.nspname = 'public'
    group by c.conname, cl.relname, rcl.relname`);
  const pks = await db.query<{ table: string; cols: string[] }>(`
    select cl.relname as "table", array_agg(a.attname::text order by a.attnum) as cols
    from pg_index i join pg_class cl on cl.oid = i.indrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary and n.nspname = 'public' group by cl.relname`);
  const fns = await db.query<{ name: string; retset: boolean; rettype: string; argnames: string[] | null; argtypes: string[] }>(`
    select p.proname as name, p.proretset as retset, t.typname as rettype, p.proargnames as argnames,
           array(select format_type(x, null) from unnest(p.proargtypes::oid[]) x) as argtypes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
    where n.nspname = 'public'`);
  return {
    fks: fks.rows,
    pks: Object.fromEntries(pks.rows.map((r) => [r.table, r.cols])),
    fns: Object.fromEntries(fns.rows.map((f) => [f.name, {
      retset: f.retset, rettype: f.rettype,
      args: Object.fromEntries((f.argnames ?? []).map((n, i) => [n, f.argtypes[i] ?? "text"])),
    }])),
  };
}

async function initialise(state: State, fresh: boolean) {
  const { db } = state;
  const root = join(process.cwd(), "supabase");
  const migrations = readdirSync(join(root, "migrations")).filter((x) => x.endsWith(".sql")).sort();
  if (fresh) {
    await db.exec(PLATFORM_STUB);
    for (const f of migrations) await db.exec(readFileSync(join(root, "migrations", f), "utf8"));
    await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
    await db.exec("create table public._local_meta (key text primary key, value text); revoke all on public._local_meta from anon, authenticated;");
    for (const f of migrations) await db.query("insert into public._local_meta values ($1, now()::text)", [`migration:${f}`]);
  } else {
    // Apply migrations added since this local database was created.
    const done = new Set((await db.query<{ key: string }>("select key from public._local_meta where key like 'migration:%'")).rows.map((r) => r.key));
    for (const f of migrations) {
      if (done.has(`migration:${f}`)) continue;
      await db.transaction(async (tx) => {
        await tx.exec(readFileSync(join(root, "migrations", f), "utf8"));
        await tx.query("insert into public._local_meta values ($1, now()::text)", [`migration:${f}`]);
      });
      console.log(`[local-db] applied migration ${f}`);
    }
  }
  state.meta = await loadMeta(db);
  if (fresh) {
    const { seedLocalDemo } = await import("./seed");
    await seedLocalDemo();
    await db.query("insert into public._local_meta values ('seeded', now()::text)");
  }
}

export function localState(): State {
  if (!g.__fermierLocal) {
    mkdirSync(DATA_DIR, { recursive: true });
    const dir = join(DATA_DIR, "pglite");
    const fresh = !existsSync(join(dir, "PG_VERSION"));
    const db = new PGlite(dir, { extensions: { pg_trgm, pgcrypto } });
    const state: State = { db, meta: { fks: [], pks: {}, fns: {} }, ready: Promise.resolve(), queue: Promise.resolve() };
    g.__fermierLocal = state;
    state.ready = db.waitReady.then(() => initialise(state, fresh)).catch((e) => {
      g.__fermierLocal = undefined;
      console.error("[local-db] initialisation failed", e);
      throw e;
    });
  }
  return g.__fermierLocal;
}

export type Ctx = { userId: string | null; service: boolean };

/** Runs fn in a serialised transaction, with RLS applied for the given user (service = bypass, like service_role). */
export async function withContext<T>(ctx: Ctx, fn: (tx: Transaction, meta: Meta) => Promise<T>, opts: { skipReady?: boolean } = {}): Promise<T> {
  const state = localState();
  if (!opts.skipReady) await state.ready;
  const run = async () =>
    state.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [ctx.userId ?? ""]);
      await tx.query("set local timezone = 'UTC'");
      if (!ctx.service) await tx.exec(`set local role ${ctx.userId ? "authenticated" : "anon"}`);
      return fn(tx, state.meta);
    });
  const p = state.queue.then(run, run);
  state.queue = p.catch(() => undefined);
  return p;
}
