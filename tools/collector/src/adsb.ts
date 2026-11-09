/**
 * Observed aircraft over the Gulf (slice 2, 9 Nov 2026). Runs OUTSIDE the sovereign boundary like every
 * collector: queries adsb.lol (open data, ODbL) around six Gulf hubs, keeps airline flights only, and writes a
 * signed .tigpkg. The product never calls adsb.lol; the package is imported through Data & Sources.
 *
 *   pnpm --filter @tigeris/collector adsb
 */
import { createHash, randomUUID, sign } from "node:crypto";
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { ProxyAgent, fetch as ufetch } from "undici";
import { GULF_ADSB_POINTS, PACKAGE_FORMAT, canonicalJson, summariseAdsb, type AdsbReply, type PackageFile, type TransferPackage } from "@tigeris/shared";
import { collectorKeys } from "./keys";

const OUT = path.resolve(import.meta.dirname, "../../../data/packages");
const BASE = "https://api.adsb.lol/v2";
const proxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;

async function main() {
  const replies: AdsbReply[] = [];
  const attempts: Array<{ sourceKey: string; url: string; outcome: "collected" | "failed"; detail: string }> = [];
  for (const p of GULF_ADSB_POINTS) {
    const url = `${BASE}/lat/${p.lat}/lon/${p.lon}/dist/${p.nm}`;
    try {
      const res = await ufetch(url, { dispatcher: proxy, headers: { "user-agent": "TIGERIS-collector/0.1 (demonstration snapshot)" }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as AdsbReply;
      replies.push(j);
      attempts.push({ sourceKey: "adsb.gulf", url, outcome: "collected", detail: `${p.name}: ${j.ac?.length ?? 0} aircraft` });
    } catch (e) {
      attempts.push({ sourceKey: "adsb.gulf", url, outcome: "failed", detail: `${p.name}: ${(e as Error).message}` });
    }
  }
  const capturedAt = new Date().toISOString();
  const snap = summariseAdsb(replies, capturedAt, GULF_ADSB_POINTS.filter((_, i) => attempts[i]?.outcome === "collected").map((p) => p.name));
  if (!snap.aircraft.length) throw new Error(`No airline flights in ${replies.length} replies; nothing written`);

  const buf = Buffer.from(JSON.stringify(snap));
  const name = "adsb-gulf-snapshot.json";
  const kept = snap.aircraft.length;
  const file: PackageFile = {
    name, sourceKey: "adsb.gulf", title: "Observed aircraft over the Gulf (ADS-B snapshot)", originalUrl: "https://adsb.lol", mediaType: "application/json",
    eventTime: capturedAt, sourceVersion: `ADS-B ${capturedAt.slice(0, 16)}Z`, licence: "ODbL 1.0 (adsb.lol open data)",
    transformations: [
      { step: "filter_rows", detail: `Merged ${replies.length} area queries (${snap.points.join(", ")}) by aircraft and kept the newest position.`, rowsBefore: snap.seen, rowsAfter: snap.seen - snap.excluded.duplicate - snap.excluded.noPosition },
      { step: "filter_rows", detail: "Kept airline flights only (three-letter operator code and flight number); private and general-aviation aircraft dropped because they can identify individuals.", rowsBefore: kept + snap.excluded.notAirline, rowsAfter: kept },
    ],
    size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt: capturedAt,
  };
  const keys = collectorKeys();
  const manifest = { packageId: randomUUID(), createdAt: capturedAt, sender: "TIGERIS public-data collector (demonstration)", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const, files: [file], attempts };
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: keys.fingerprint, value: sign(null, Buffer.from(canonicalJson(manifest)), keys.privateKey).toString("base64") }, files: { [name]: buf.toString("base64") } };
  for (const old of readdirSync(OUT).filter((f) => f.startsWith("adsb-gulf-") && f.endsWith(".tigpkg"))) rmSync(path.join(OUT, old));
  const out = `adsb-gulf-${capturedAt.slice(0, 16).replace(/[:T]/g, "")}.tigpkg`;
  writeFileSync(path.join(OUT, out), gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 }));
  console.log(`wrote ${out}: ${kept} airline flights from ${snap.seen} aircraft reports (${snap.excluded.notAirline} non-airline dropped)`);
}

if (process.argv[1]?.endsWith("adsb.ts")) main().catch((e) => { console.error(e.message); process.exit(1); });
