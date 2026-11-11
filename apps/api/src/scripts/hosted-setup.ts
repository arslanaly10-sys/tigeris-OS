import { fileURLToPath } from "node:url";
import { closePools, ownerPool } from "../db";
import { migrate } from "./migrate";
import { resetDemo } from "./seed-data";

/**
 * Hosted setup (Vercel build step, ADR-0003). Runs as the database owner:
 * 1. creates or updates the application role tigeris_app (LOGIN, NOSUPERUSER, NOBYPASSRLS) with TIGERIS_APP_PASSWORD;
 * 2. applies any new migrations;
 * 3. seeds the demo only when the database has no institutions yet, so a redeploy never wipes a running demo.
 * Skips quietly when no hosted database is configured (local builds).
 */
export async function hostedSetup(log = console.log) {
  if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) { log("hosted setup: no hosted database configured, skipping"); return; }
  const pw = process.env.TIGERIS_APP_PASSWORD;
  if (!pw) throw new Error("TIGERIS_APP_PASSWORD is not set; the application role cannot be created.");
  const pool = ownerPool();
  const quoted = `'${pw.replace(/'/g, "''")}'`;
  const exists = (await pool.query("SELECT 1 FROM pg_roles WHERE rolname = 'tigeris_app'")).rowCount;
  await pool.query(exists
    ? `ALTER ROLE tigeris_app WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${quoted}`
    : `CREATE ROLE tigeris_app WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${quoted}`);
  log(`hosted setup: application role ${exists ? "updated" : "created"}`);
  await migrate(log);
  const seeded = (await pool.query("SELECT to_regclass('public.institutions') IS NOT NULL AS t")).rows[0].t
    && Number((await pool.query("SELECT count(*) AS n FROM institutions")).rows[0].n) > 0;
  if (seeded) log("hosted setup: demo data already present, leaving it as it is");
  else { await resetDemo(); log("hosted setup: demo data seeded"); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await hostedSetup();
  await closePools();
}
