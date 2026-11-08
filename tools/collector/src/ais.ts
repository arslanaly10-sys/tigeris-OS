/**
 * Observed vessels in the Strait of Hormuz (FR-30, MAP §6; Q086 live AIS).
 *
 * Runs OUTSIDE the sovereign boundary like every collector. It listens to the aisstream.io AIS stream
 * for a fixed window, keeps the latest report per vessel inside the Hormuz box, and writes a signed
 * .tigpkg. The product never connects to aisstream.io itself: the package is imported through Data &
 * Sources, so what the map shows is an observed snapshot with a capture time, not a live feed.
 *
 *   AISSTREAM_API_KEY=… pnpm --filter @tigeris/collector ais              # 10-minute window
 *   AISSTREAM_API_KEY=… pnpm --filter @tigeris/collector ais -- --minutes 3
 */
import { createHash, randomUUID, sign } from "node:crypto";
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { ProxyAgent, WebSocket } from "undici";
import { HORMUZ_BBOX, PACKAGE_FORMAT, canonicalJson, summariseAis, type AisMessage, type PackageFile, type TransferPackage } from "@tigeris/shared";
import { collectorKeys } from "./keys";

const OUT = path.resolve(import.meta.dirname, "../../../data/packages");
const URL = "wss://stream.aisstream.io/v0/stream";
const MESSAGE_TYPES = ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"];

function capture(apiKey: string, minutes: number): Promise<{ messages: AisMessage[]; from: string; to: string }> {
  const proxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
  return new Promise((resolve, reject) => {
    const messages: AisMessage[] = [];
    const from = new Date().toISOString();
    const ws = new WebSocket(URL, proxy ? { dispatcher: proxy } : undefined);
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      if (err && !messages.length) reject(err);
      else resolve({ messages, from, to: new Date().toISOString() });
    };
    const timer = setTimeout(() => finish(), minutes * 60_000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ APIKey: apiKey, BoundingBoxes: [HORMUZ_BBOX], FilterMessageTypes: MESSAGE_TYPES }));
      console.log(`listening to AIS in the Hormuz box for ${minutes} min…`);
    });
    ws.addEventListener("message", async (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data instanceof Blob ? await ev.data.arrayBuffer() : (ev.data as ArrayBuffer)).toString("utf8");
      try {
        const m = JSON.parse(raw) as AisMessage & { error?: string };
        if (m.error) return finish(new Error(`aisstream.io refused the subscription: ${m.error}`));
        messages.push(m);
        if (messages.length % 500 === 0) console.log(`  ${messages.length} messages`);
      } catch { /* ignore malformed frames */ }
    });
    ws.addEventListener("error", (e) => finish(new Error(`AIS stream error: ${(e as ErrorEvent).message ?? "connection failed"}`)));
    ws.addEventListener("close", (e) => finish(messages.length ? undefined : new Error(`AIS stream closed (${e.code}${e.reason ? `: ${e.reason}` : ""}) before any message arrived; check the key and network access`)));
  });
}

async function main() {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) throw new Error("Set AISSTREAM_API_KEY (free key from aisstream.io) in the environment.");
  const i = process.argv.indexOf("--minutes");
  const minutes = i > 0 ? Math.max(1, Math.min(60, Number(process.argv[i + 1]) || 10)) : 10;

  const { messages, from, to } = await capture(apiKey, minutes);
  const snap = summariseAis(messages, { from, to });
  if (!snap.vessels.length) throw new Error(`${messages.length} messages but no vessel positions inside the box; nothing written`);

  const buf = Buffer.from(JSON.stringify(snap));
  const name = "ais-hormuz-snapshot.json";
  const file: PackageFile = {
    name, sourceKey: "aisstream.hormuz", title: "Observed vessels, Strait of Hormuz (AIS snapshot)", originalUrl: "https://aisstream.io", mediaType: "application/json",
    eventTime: to, sourceVersion: `AIS ${from.slice(0, 16)}Z to ${to.slice(11, 16)}Z`, licence: "aisstream.io terms of service; AIS broadcast data",
    transformations: [
      { step: "filter_rows", detail: `Kept the latest position per vessel inside lat ${HORMUZ_BBOX[0][0]}–${HORMUZ_BBOX[1][0]}, lon ${HORMUZ_BBOX[0][1]}–${HORMUZ_BBOX[1][1]}; merged name, type and destination from static reports.`, rowsBefore: snap.positionReports, rowsAfter: snap.vessels.length + snap.excluded.pleasureOrSailing },
      { step: "filter_rows", detail: "Dropped pleasure craft and sailing yachts (AIS types 36–37): usually private individuals and not relevant to shipping risk.", rowsBefore: snap.vessels.length + snap.excluded.pleasureOrSailing, rowsAfter: snap.vessels.length },
    ],
    size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt: to,
  };
  const keys = collectorKeys();
  const manifest = { packageId: randomUUID(), createdAt: to, sender: "TIGERIS public-data collector (demonstration)", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const, files: [file],
    attempts: [{ sourceKey: "aisstream.hormuz", url: URL, outcome: "collected" as const, detail: `${messages.length} messages in ${minutes} min; ${snap.vessels.length} vessels kept` }] };
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: keys.fingerprint, value: sign(null, Buffer.from(canonicalJson(manifest)), keys.privateKey).toString("base64") }, files: { [name]: buf.toString("base64") } };

  // One AIS snapshot at a time: a newer capture replaces the older package.
  for (const old of readdirSync(OUT).filter((f) => f.startsWith("ais-hormuz-") && f.endsWith(".tigpkg"))) rmSync(path.join(OUT, old));
  const out = `ais-hormuz-${to.slice(0, 16).replace(/[:T]/g, "")}.tigpkg`;
  writeFileSync(path.join(OUT, out), gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 }));
  const byCat = snap.vessels.reduce<Record<string, number>>((a, v) => ((a[v.category] = (a[v.category] ?? 0) + 1), a), {});
  console.log(`wrote ${out}: ${snap.vessels.length} vessels from ${messages.length} messages`, byCat);
}

if (process.argv[1]?.endsWith("ais.ts")) main().catch((e) => { console.error(e.message); process.exit(1); });
