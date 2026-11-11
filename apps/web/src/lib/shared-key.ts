import "server-only";
import { createHash } from "node:crypto";

/**
 * The key the web app sends to the API on hosted deployments (x-tigeris-key). Explicit TIGERIS_SHARED_KEY wins; otherwise
 * it is derived from the database credential the platform attaches to both projects, exactly as the API derives it.
 */
export function sharedKey(): string {
  if (process.env.TIGERIS_SHARED_KEY) return process.env.TIGERIS_SHARED_KEY;
  const raw = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!raw) return "";
  const pw = decodeURIComponent(new URL(raw).password);
  return pw ? createHash("sha256").update(`tigeris|shared-key|${pw}`).digest("base64url") : "";
}
