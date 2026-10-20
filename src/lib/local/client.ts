import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { DATA_DIR, localState, withContext, type Ctx } from "./db";
import { callRpc, QueryBuilder } from "./query";

export const SESSION_COOKIE = "fa_session";

function secret() {
  if (process.env.LOCAL_AUTH_SECRET) return process.env.LOCAL_AUTH_SECRET;
  const f = join(DATA_DIR, "secret");
  if (!existsSync(f)) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 }); }
  return readFileSync(f, "utf8").trim();
}
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function encodeSession(uid: string) {
  const exp = Date.now() + 7 * 86400_000;
  return `${uid}.${exp}.${sign(`${uid}.${exp}`)}`;
}
export function decodeSession(v: string | undefined): string | null {
  if (!v) return null;
  const [uid, exp, sig] = v.split(".");
  if (!uid || !exp || !sig || Number(exp) < Date.now()) return null;
  return safeEq(sig, sign(`${uid}.${exp}`)) ? uid : null;
}

export function signedFileUrl(bucket: string, path: string, ttlSec: number) {
  const exp = Date.now() + ttlSec * 1000;
  return `/api/local-files/${bucket}/${path}?exp=${exp}&sig=${sign(`${bucket}/${path}.${exp}`)}`;
}
export function verifyFileSig(bucket: string, path: string, exp: string | null, sig: string | null) {
  return !!exp && !!sig && Number(exp) > Date.now() && safeEq(sig, sign(`${bucket}/${path}.${exp}`));
}
export function filePath(bucket: string, path: string) {
  const root = join(DATA_DIR, "storage", bucket);
  const full = normalize(join(root, path));
  if (!full.startsWith(root + "/")) throw new Error("Invalid path");
  return full;
}

type Cookies = { get: (n: string) => string | undefined; set: (n: string, v: string) => void; remove: (n: string) => void };
type User = { id: string; email: string; user_metadata: Record<string, unknown> };
const err = (message: string, code = "auth_error") => ({ message, code, name: "AuthError", status: 400 });

async function toBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body && typeof (body as Blob).arrayBuffer === "function") return Buffer.from(await (body as Blob).arrayBuffer());
  return Buffer.from(String(body));
}

export function createLocalClient(opts: { cookies?: Cookies; service?: boolean; userId?: string | null; skipReady?: boolean }) {
  const userId = () => opts.userId ?? decodeSession(opts.cookies?.get(SESSION_COOKIE));
  const ctx = (): Ctx => ({ userId: opts.service ? null : userId(), service: !!opts.service });
  const skip = !!opts.skipReady;

  const loadUser = async (id: string | null): Promise<User | null> => {
    if (!id) return null;
    const r = await withContext({ userId: null, service: true }, (tx) =>
      tx.query<{ id: string; email: string; meta: Record<string, unknown> }>("select id, email, raw_user_meta_data as meta from auth.users where id = $1 and (banned_until is null or banned_until < now())", [id]), { skipReady: skip });
    const u = r.rows[0];
    return u ? { id: u.id, email: u.email, user_metadata: u.meta } : null;
  };

  const admin = {
    async createUser(a: { email: string; password: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) {
      try {
        const r = await withContext({ userId: null, service: true }, (tx) =>
          tx.query<{ id: string }>("insert into auth.users (email, encrypted_password, raw_user_meta_data) values (lower($1), crypt($2, gen_salt('bf', 8)), $3) returning id",
            [a.email, a.password, JSON.stringify(a.user_metadata ?? {})]), { skipReady: skip });
        return { data: { user: { id: r.rows[0].id, email: a.email.toLowerCase(), user_metadata: a.user_metadata ?? {} } }, error: null };
      } catch (e) {
        const m = (e as Error).message;
        return { data: { user: null }, error: err(m.includes("duplicate") ? "A user with this email address has already been registered" : m) };
      }
    },
    async deleteUser(id: string) {
      await withContext({ userId: null, service: true }, (tx) => tx.query("delete from auth.users where id = $1", [id]), { skipReady: skip });
      return { data: {}, error: null };
    },
    async listUsers() {
      const r = await withContext({ userId: null, service: true }, (tx) => tx.query<{ id: string; email: string }>("select id, email from auth.users"), { skipReady: skip });
      return { data: { users: r.rows }, error: null };
    },
    async updateUserById(id: string, a: { ban_duration?: string; password?: string }) {
      await withContext({ userId: null, service: true }, async (tx) => {
        if (a.ban_duration) await tx.query("update auth.users set banned_until = case when $2 = 'none' then null else now() + interval '100 years' end where id = $1", [id, a.ban_duration]);
        if (a.password) await tx.query("update auth.users set encrypted_password = crypt($2, gen_salt('bf', 8)) where id = $1", [id, a.password]);
      }, { skipReady: skip });
      return { data: {}, error: null };
    },
  };

  const auth = {
    admin,
    async getUser() { return { data: { user: await loadUser(userId()) }, error: null }; },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const r = await withContext({ userId: null, service: true }, (tx) =>
        tx.query<{ id: string }>("select id from auth.users where email = lower($1) and encrypted_password = crypt($2, encrypted_password) and (banned_until is null or banned_until < now())", [email, password]), { skipReady: skip });
      const id = r.rows[0]?.id;
      if (!id) return { data: { user: null, session: null }, error: err("Invalid login credentials", "invalid_credentials") };
      opts.cookies?.set(SESSION_COOKIE, encodeSession(id));
      if (!opts.cookies) opts.userId = id;
      return { data: { user: await loadUser(id), session: { user: { id } } }, error: null };
    },
    async signOut() { opts.cookies?.remove(SESSION_COOKIE); return { error: null }; },
  };

  const storage = {
    from(bucket: string) {
      return {
        async upload(path: string, body: unknown, o?: { contentType?: string; upsert?: boolean }) {
          try {
            const buf = await toBuffer(body);
            const type = o?.contentType ?? (body as Blob)?.type ?? "application/octet-stream";
            await withContext(ctx(), async (tx) => {
              const b = await tx.query<{ file_size_limit: number | null; allowed_mime_types: string[] | null }>("select file_size_limit, allowed_mime_types from storage.buckets where id = $1", [bucket]);
              if (!b.rows[0]) throw new Error("Bucket not found");
              if (b.rows[0].file_size_limit && buf.length > Number(b.rows[0].file_size_limit)) throw new Error("The object exceeded the maximum allowed size");
              if (b.rows[0].allowed_mime_types && !b.rows[0].allowed_mime_types.includes(type)) throw new Error(`mime type ${type} is not supported`);
              await tx.query("insert into storage.objects (bucket_id, name, owner, mimetype, size) values ($1, $2, auth.uid(), $3, $4)", [bucket, path, type, buf.length]);
              const f = filePath(bucket, path);
              mkdirSync(dirname(f), { recursive: true });
              writeFileSync(f, buf);
            }, { skipReady: skip });
            return { data: { path }, error: null };
          } catch (e) {
            return { data: null, error: { message: (e as Error).message.includes("row-level security") ? "new row violates row-level security policy" : (e as Error).message } };
          }
        },
        async createSignedUrl(path: string, ttl: number) {
          const r = await withContext(ctx(), (tx) => tx.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucket, path]), { skipReady: skip });
          if (!r.rows.length) return { data: null, error: { message: "Object not found" } };
          return { data: { signedUrl: signedFileUrl(bucket, path, ttl) }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `/api/local-files/public/${bucket}/${path}` } };
        },
        async remove(paths: string[]) {
          const r = await withContext(ctx(), (tx) => tx.query<{ name: string }>("delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name", [bucket, `{${paths.map((x) => `"${x}"`).join(",")}}`]), { skipReady: skip });
          for (const row of r.rows) rmSync(filePath(bucket, row.name), { force: true });
          return { data: r.rows, error: null };
        },
      };
    },
  };

  return {
    from: (table: string) => new QueryBuilder(ctx(), table, skip),
    rpc: (fn: string, args?: Record<string, unknown>) => callRpc(ctx(), fn, args, skip),
    auth,
    storage,
  };
}

export async function ensureLocalReady() {
  await localState().ready;
}
