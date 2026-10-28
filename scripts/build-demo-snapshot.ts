/**
 * Builds demo-snapshot/fermier-db.tar.gz: the embedded demo database with every migration, the real catalogue
 * and the demo seed already applied. Serverless hosts (Vercel) load it into memory on start-up, so pages are
 * fast and nothing is written to disk. Runs automatically before `next build` (see package.json).
 *
 *   npm run snapshot
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

process.env.LOCAL_DB_MEMORY = "1";
process.env.LOCAL_DB_SNAPSHOT = "0"; // always build from scratch, never from an older snapshot

async function main() {
  const started = Date.now();
  const { localState, SNAPSHOT_FILE } = await import("../src/lib/local/db");
  const state = localState();
  await state.ready;
  const dump = await state.db.dumpDataDir("gzip");
  mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, Buffer.from(await dump.arrayBuffer()));
  await state.db.close();
  console.log(`[snapshot] wrote ${SNAPSHOT_FILE} (${(dump.size / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("[snapshot] failed", e);
  process.exit(1);
});
