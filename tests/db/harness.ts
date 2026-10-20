import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..", "supabase");

// Minimal stand-in for the Supabase platform pieces the migrations depend on.
const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
`;

export async function createDb(opts: { realCatalog?: boolean } = {}) {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto } });
  await db.exec(SUPABASE_STUB);
  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) {
    if (f.includes("storage")) continue;
    await db.exec(readFileSync(join(root, "migrations", f), "utf8"));
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  if (opts.realCatalog) await db.exec(readFileSync(join(root, "seed-real-catalog.sql"), "utf8"));
  return db;
}

export async function createUser(db: PGlite, email: string, roles: string[], customerCode?: string) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users(id, email) values (gen_random_uuid(), $1) returning id",
    [email],
  );
  const id = rows[0].id;
  for (const r of roles) await db.query("insert into user_roles(user_id, role) values ($1, $2)", [id, r]);
  if (customerCode) {
    await db.query(
      "insert into customer_users(user_id, customer_id) select $1, id from customers where customer_code = $2",
      [id, customerCode],
    );
  }
  return id;
}

/** Run fn as an authenticated user, with RLS applied, inside a transaction that is committed. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await db.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    const out = await fn(db);
    await db.exec("commit");
    return out;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
