import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const KEY_DIR = path.resolve(import.meta.dirname, "../../../data/keys");
const PRIV = path.join(KEY_DIR, "collector-ed25519.key.pem"); // never committed
const PUB = path.join(KEY_DIR, "collector-ed25519.pub.pem");

export function fingerprint(pubPem: string): string {
  const der = createPublicKey(pubPem).export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 32);
}

/** Loads the collector signing key, creating one on first use. */
export function collectorKeys(): { privateKey: KeyObject; publicPem: string; fingerprint: string } {
  if (!existsSync(PRIV)) {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(PRIV, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    writeFileSync(PUB, publicKey.export({ type: "spki", format: "pem" }));
  }
  const publicPem = readFileSync(PUB, "utf8");
  return { privateKey: createPrivateKey(readFileSync(PRIV)), publicPem, fingerprint: fingerprint(publicPem) };
}
