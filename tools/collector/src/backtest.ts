/**
 * Back-test package (Q050, TR-039). Collects the EIA daily Brent spot price series and keeps only the
 * trading days around four historical supply disruptions; the filter is recorded as a transformation.
 * The disruption sizes are analyst estimates of widely reported figures and are labelled as assumptions.
 *
 *   pnpm --filter @tigeris/collector backtest
 */
import { createHash, randomUUID, sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { PACKAGE_FORMAT, canonicalJson, type PackageFile, type TransferPackage } from "@tigeris/shared";
import { ProxyAgent, fetch as ufetch } from "undici";
import { collectorKeys } from "./keys";

const proxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;

const OUT = path.resolve(import.meta.dirname, "../../../data/packages");
const URL = "https://www.eia.gov/dnav/pet/hist/RBRTEd.htm";
const WINDOW = 25; // trading days kept on each side of an episode

export const EPISODES = [
  { key: "episode:iraq-kuwait-1990", name: "Iraq invades Kuwait", date: "1990-08-02", lossMbd: 4.3, worldMbd: 66.5,
    basis: "Iraqi and Kuwaiti exports halted; about 4.3 mb/d is the widely cited loss. World demand about 66.5 mb/d in 1990. Analyst estimate to verify against IEA records." },
  { key: "episode:katrina-2005", name: "Hurricane Katrina shuts Gulf of Mexico output", date: "2005-08-29", lossMbd: 1.4, worldMbd: 84.0,
    basis: "About 1.4 mb/d of US Gulf of Mexico crude output shut in at the peak. World demand about 84 mb/d in 2005. Analyst estimate to verify against EIA records." },
  { key: "episode:libya-2011", name: "Libyan output collapses in civil conflict", date: "2011-02-22", lossMbd: 1.3, worldMbd: 88.5,
    basis: "Most of about 1.6 mb/d of Libyan output stopped; about 1.3 mb/d is used for the first weeks. World demand about 88.5 mb/d in 2011. Analyst estimate to verify against IEA records." },
  { key: "episode:abqaiq-2019", name: "Attack on Abqaiq processing", date: "2019-09-16", lossMbd: 5.7, worldMbd: 100.0,
    basis: "About 5.7 mb/d of processing was taken offline; most was restored within weeks. World demand about 100 mb/d in 2019. Analyst estimate to verify against IEA records." },
];

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** EIA weekly rows: "1990 Jul-30 to Aug- 3" followed by five daily cells, Monday to Friday. */
export function parseEiaDaily(html: string): Array<{ date: string; value: number }> {
  const out: Array<{ date: string; value: number }> = [];
  const rows = html.replace(/\r/g, "\n").split(/<tr>/i);
  for (const r of rows) {
    const head = r.match(/class='B6'>&nbsp;&nbsp;(\d{4}) (\w{3})-\s?(\d{1,2}) to/);
    if (!head) continue;
    const cells = [...r.matchAll(/class='B3'>([^<]*)</g)].map((m) => m[1]!.trim());
    const start = new Date(Date.UTC(Number(head[1]), Number(MONTHS[head[2]!]) - 1, Number(head[3])));
    cells.forEach((c, i) => {
      if (!c) return;
      const d = new Date(start.getTime() + i * 86_400_000);
      out.push({ date: d.toISOString().slice(0, 10), value: Number(c) });
    });
  }
  return out;
}

async function main() {
  const res = await ufetch(URL, { dispatcher: proxy });
  if (!res.ok) throw new Error(`EIA returned HTTP ${res.status}`);
  const html = await res.text();
  const all = parseEiaDaily(html);
  if (all.length < 5000) throw new Error(`Only ${all.length} daily prices parsed; page format may have changed`);
  const keep = new Set<number>();
  for (const e of EPISODES) {
    const i = all.findIndex((p) => p.date >= e.date);
    for (let j = Math.max(0, i - WINDOW); j <= Math.min(all.length - 1, i + WINDOW); j++) keep.add(j);
  }
  const points = all.filter((_, i) => keep.has(i));
  const retrievedAt = new Date().toISOString();
  const files: Array<{ meta: Omit<PackageFile, "size" | "sha256" | "retrievedAt">; json: unknown }> = [
    { meta: { name: "eia-brent-daily-episode-windows.json", sourceKey: "eia.brent", title: "Europe Brent spot price FOB, daily (episode windows)", originalUrl: URL, mediaType: "application/json", eventTime: `${all.at(-1)!.date}T00:00:00.000Z`, sourceVersion: `RBRTE daily to ${all.at(-1)!.date}`, licence: "Public domain (U.S. EIA)",
        transformations: [{ step: "filter_rows", detail: `Kept ${WINDOW} trading days either side of ${EPISODES.length} disruption dates for back-testing; other days dropped.`, rowsBefore: all.length, rowsAfter: points.length }] },
      json: { series: "RBRTE", label: "Europe Brent Spot Price FOB", unit: "USD/bbl", points } },
    { meta: { name: "supply-disruption-episodes.json", sourceKey: "tigeris.episodes", title: "Historical supply disruption episodes (analyst estimates)", originalUrl: "", mediaType: "application/json", eventTime: retrievedAt, sourceVersion: "episodes-v1", licence: "Analyst estimates for the demonstration", transformations: [] },
      json: { version: "episodes-v1", note: "Loss and world-demand figures are analyst estimates of widely reported values; verify before relying on them.", episodes: EPISODES } },
  ];
  const keys = collectorKeys();
  const entries: PackageFile[] = [];
  const content: Record<string, string> = {};
  for (const f of files) {
    const buf = Buffer.from(JSON.stringify(f.json));
    entries.push({ ...f.meta, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt });
    content[f.meta.name] = buf.toString("base64");
  }
  const manifest = { packageId: randomUUID(), createdAt: retrievedAt, sender: "TIGERIS public-data collector (demonstration)", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const, files: entries,
    attempts: [{ sourceKey: "eia.brent", url: URL, outcome: "collected" as const, detail: `${all.length} daily prices parsed; ${points.length} kept` }] };
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: keys.fingerprint, value: sign(null, Buffer.from(canonicalJson(manifest)), keys.privateKey).toString("base64") }, files: content };
  const file = `backtest-brent-episodes-${retrievedAt.slice(0, 10)}.tigpkg`;
  writeFileSync(path.join(OUT, file), gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 }));
  console.log(`wrote ${file}: ${all.length} days parsed, ${points.length} kept`);
}

if (process.argv[1]?.endsWith("backtest.ts")) main().catch((e) => { console.error(e.message); process.exit(1); });
