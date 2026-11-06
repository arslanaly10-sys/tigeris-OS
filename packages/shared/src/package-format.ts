/**
 * TIGERIS transfer package (TR-017, Q092). A collector outside the sovereign boundary fetches
 * sources and writes one gzip-compressed JSON file (.tigpkg). Inside the boundary, the import
 * verifies the signature over the manifest, then each file's SHA-256, before anything is ingested.
 */
export const PACKAGE_FORMAT = "tigeris.package/v1";

export interface PackageTransformation {
  step: string; // e.g. "filter_rows"
  detail: string; // human-readable description of exactly what was kept or changed
  rowsBefore?: number;
  rowsAfter?: number;
}

export interface PackageFile {
  name: string;
  sourceKey: string;
  title: string;
  originalUrl: string;
  mediaType: string;
  size: number;
  sha256: string;
  retrievedAt: string;
  eventTime: string | null;
  sourceVersion: string | null;
  licence: string;
  transformations: PackageTransformation[];
}

export interface CollectionAttempt {
  sourceKey: string;
  url: string;
  outcome: "collected" | "unreachable" | "skipped";
  detail: string;
}

export interface PackageManifest {
  packageId: string;
  createdAt: string;
  sender: string;
  collectorVersion: string;
  intendedEnvironment: string;
  schemaVersion: 1;
  files: PackageFile[];
  attempts: CollectionAttempt[];
}

export interface TransferPackage {
  format: typeof PACKAGE_FORMAT;
  manifest: PackageManifest;
  signature: { algorithm: "ed25519"; keyFingerprint: string; value: string };
  files: Record<string, string>; // name -> base64 content
}

/** Stable JSON with recursively sorted keys; used for signatures and audit hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).filter((k) => obj[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}
