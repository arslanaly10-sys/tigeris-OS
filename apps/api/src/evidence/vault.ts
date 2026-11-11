import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

/** Institution-controlled evidence store. Content-addressed and write-once (TRD §4 Evidence Vault). */
const ROOT = path.resolve(process.env.VAULT_DIR ?? (process.env.VERCEL ? "/tmp/tigeris-vault" : path.join(import.meta.dirname, "../../../../data/vault")));

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export async function putObject(institutionId: string, bytes: Buffer): Promise<{ key: string; sha256: string }> {
  const hash = sha256(bytes);
  const key = `${institutionId}/${hash.slice(0, 2)}/${hash}`;
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "w" });
  return { key, sha256: hash };
}

export async function getObject(institutionId: string, key: string): Promise<Buffer> {
  if (!key.startsWith(`${institutionId}/`) || key.includes("..")) throw new Error("object outside institution scope");
  return readFile(path.join(ROOT, key));
}
