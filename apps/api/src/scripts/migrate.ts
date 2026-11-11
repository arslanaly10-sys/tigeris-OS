import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ownerPool, closePools } from "../db";

const dir = path.join(process.env.TIGERIS_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."), "db/migrations");

export async function migrate(log = console.log) {
  const pool = ownerPool();
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await c.query("COMMIT");
      log(`applied ${f}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
  await closePools();
}
