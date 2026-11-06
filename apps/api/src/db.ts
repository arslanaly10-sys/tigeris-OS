import pg from "pg";
import { config } from "./config";

/** Application pool: non-owner role without BYPASSRLS. All tenant data goes through withTenant. */
export const appPool = new pg.Pool({ connectionString: config.appUrl, max: 10 });

/** Owner pool: migrations, seeding and demo reset only. Never used to serve requests. */
let owner: pg.Pool | undefined;
export function ownerPool(): pg.Pool {
  owner ??= new pg.Pool({ connectionString: config.ownerUrl, max: 2 });
  return owner;
}

export type Tx = pg.PoolClient;

/**
 * Runs fn in a transaction scoped to one institution. The scope is set transaction-locally
 * (set_config(..., true)) so pooled connections never keep tenant state (SCH §3).
 */
export async function withTenant<T>(institutionId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.institution_id', $1, true)", [institutionId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePools(): Promise<void> {
  await appPool.end();
  if (owner) await owner.end();
}
