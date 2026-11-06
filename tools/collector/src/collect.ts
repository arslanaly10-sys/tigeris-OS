/**
 * External public-data collector (SCOPE §8, DS §5, TR-014, TR-017).
 *
 * Runs OUTSIDE the sovereign boundary. Fetches dated public snapshots, records exactly what was
 * fetched and any filtering applied, then writes a signed .tigpkg transfer package. The TIGERIS
 * product never calls these hosts itself: the package is imported through Data & Sources.
 *
 *   pnpm --filter @tigeris/collector collect
 */
import { createHash, randomUUID, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { ProxyAgent, fetch as ufetch } from "undici";
import {
  PACKAGE_FORMAT, canonicalJson, parseCsv, toCsv,
  type CollectionAttempt, type PackageFile, type PackageManifest, type PackageTransformation, type TransferPackage,
} from "@tigeris/shared";
import { collectorKeys } from "./keys";

const OUT_DIR = path.resolve(import.meta.dirname, "../../../data/packages");
const GCC_ISO3 = ["SAU", "ARE", "QAT", "KWT", "OMN", "BHR"];
const GCC_ISO2 = ["SA", "AE", "QA", "KW", "OM", "BH"];
const proxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;

async function get(url: string): Promise<{ body: Buffer; contentType: string; lastModified: string | null }> {
  const res = await ufetch(url, { dispatcher: proxy, headers: { "user-agent": "TIGERIS-collector/0.1 (demonstration snapshot)" }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream", lastModified: res.headers.get("last-modified") };
}

interface Collected {
  file: Omit<PackageFile, "size" | "sha256" | "retrievedAt">;
  content: Buffer;
}

type Collector = { sourceKey: string; url: string; run: () => Promise<Collected[]> };

const WB_INDICATORS: Record<string, string> = {
  "NY.GDP.MKTP.CD": "GDP (current US$)",
  "SP.POP.TOTL": "Population, total",
  "FP.CPI.TOTL.ZG": "Inflation, consumer prices (annual %)",
  "FI.RES.TOTL.CD": "Total reserves including gold (current US$)",
  "TM.VAL.FOOD.ZS.UN": "Food imports (% of merchandise imports)",
  "TX.VAL.FUEL.ZS.UN": "Fuel exports (% of merchandise exports)",
  "TM.VAL.MRCH.CD.WT": "Merchandise imports (current US$)",
};

const IMF_INDICATORS: Record<string, string> = {
  NGDP_RPCH: "Real GDP growth (annual % change)",
  PCPIPCH: "Inflation, average consumer prices (annual % change)",
  GGXCNL_NGDP: "General government net lending/borrowing (% of GDP)",
  BCA_NGDPD: "Current account balance (% of GDP)",
};

const collectors: Collector[] = [
  {
    sourceKey: "worldbank.wdi",
    url: "https://api.worldbank.org/v2/",
    run: async () => {
      const out: Collected[] = [];
      for (const [id, label] of Object.entries(WB_INDICATORS)) {
        const url = `https://api.worldbank.org/v2/country/${GCC_ISO3.join(";")}/indicator/${id}?format=json&date=2015:2025&per_page=500`;
        const r = await get(url);
        const parsed = JSON.parse(r.body.toString("utf8"));
        out.push({
          content: r.body,
          file: {
            name: `worldbank-${id}.json`, sourceKey: "worldbank.wdi", title: `World Bank WDI · ${label} · GCC 2015–2025`, originalUrl: url,
            mediaType: "application/json", eventTime: parsed?.[0]?.lastupdated ? new Date(parsed[0].lastupdated).toISOString() : null,
            sourceVersion: parsed?.[0]?.lastupdated ?? null, licence: "CC BY 4.0 (World Bank Open Data terms)", transformations: [],
          },
        });
      }
      return out;
    },
  },
  {
    sourceKey: "imf.weo",
    url: "https://www.imf.org/external/datamapper/api/v1/",
    run: async () => {
      const out: Collected[] = [];
      for (const [id, label] of Object.entries(IMF_INDICATORS)) {
        const url = `https://www.imf.org/external/datamapper/api/v1/${id}`;
        const r = await get(url);
        const parsed = JSON.parse(r.body.toString("utf8"));
        const all = parsed.values?.[id] ?? {};
        const kept = Object.fromEntries(GCC_ISO3.filter((c) => all[c]).map((c) => [c, all[c]]));
        const body = Buffer.from(JSON.stringify({ indicator: id, label, api: parsed.api ?? null, values: { [id]: kept } }));
        out.push({
          content: body,
          file: {
            name: `imf-${id}.json`, sourceKey: "imf.weo", title: `IMF World Economic Outlook · ${label} · GCC`, originalUrl: url, mediaType: "application/json",
            eventTime: null, sourceVersion: parsed.api?.version ?? null, licence: "IMF Copyright and Usage terms",
            transformations: [{ step: "filter_countries", detail: `Kept the six GCC states (${GCC_ISO3.join(", ")}) from all countries in the response.`, rowsBefore: Object.keys(all).length, rowsAfter: Object.keys(kept).length }],
          },
        });
      }
      return out;
    },
  },
  {
    sourceKey: "jodi.oil",
    url: "https://www.jodidata.org/oil/database/data-downloads.aspx",
    run: async () => {
      const out: Collected[] = [];
      for (const year of ["2024", "2025"]) {
        const url = `https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/${year}.csv`;
        const r = await get(url);
        const rows = parseCsv(r.body.toString("utf8"));
        const header = rows[0]!;
        const kept = rows.slice(1).filter((x) => GCC_ISO2.includes(x[0]!) && x[2] === "CRUDEOIL" && (x[3] === "INDPROD" || x[3] === "TOTEXPSB") && x[4] === "KBD");
        const t: PackageTransformation = { step: "filter_rows", detail: "Kept GCC states, crude oil, production (INDPROD) and total exports (TOTEXPSB), thousand barrels per day (KBD).", rowsBefore: rows.length - 1, rowsAfter: kept.length };
        out.push({
          content: Buffer.from(toCsv([header, ...kept])),
          file: { name: `jodi-oil-primary-${year}.csv`, sourceKey: "jodi.oil", title: `JODI Oil World Database · GCC crude production and exports · ${year}`, originalUrl: url, mediaType: "text/csv", eventTime: r.lastModified ? new Date(r.lastModified).toISOString() : null, sourceVersion: r.lastModified, licence: "JODI data: free use with attribution", transformations: [t] },
        });
      }
      return out;
    },
  },
  {
    sourceKey: "eia.chokepoints",
    url: "https://www.eia.gov/todayinenergy/detail.php?id=65504",
    run: async () => {
      const url = "https://www.eia.gov/todayinenergy/detail.php?id=65504";
      const r = await get(url);
      return [{ content: r.body, file: { name: "eia-tie-65504-hormuz.html", sourceKey: "eia.chokepoints", title: "EIA Today in Energy · Amid regional conflict, the Strait of Hormuz remains critical oil chokepoint", originalUrl: url, mediaType: "text/html", eventTime: "2025-06-16T00:00:00.000Z", sourceVersion: "id=65504", licence: "U.S. Government work, public domain", transformations: [] } }];
    },
  },
  {
    sourceKey: "ofac.sdn",
    url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV",
    run: async () => {
      const url = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";
      const r = await get(url);
      const rows = parseCsv(r.body.toString("latin1")).filter((x) => x.length > 3);
      const kept = rows.filter((x) => x[2]?.trim().toLowerCase() === "vessel");
      const header = ["ent_num", "sdn_name", "sdn_type", "program", "title", "call_sign", "vess_type", "tonnage", "grt", "vess_flag", "vess_owner", "remarks"];
      return [{ content: Buffer.from(toCsv([header, ...kept.map((x) => x.map((f) => f.trim()))])), file: { name: "ofac-sdn-vessels.csv", sourceKey: "ofac.sdn", title: "OFAC Specially Designated Nationals list · vessel entries", originalUrl: url, mediaType: "text/csv", eventTime: null, sourceVersion: r.lastModified, licence: "U.S. Government work, public domain", transformations: [{ step: "filter_rows", detail: "Kept entries whose SDN type is 'vessel'; added the published column names as a header row.", rowsBefore: rows.length, rowsAfter: kept.length }] } }];
    },
  },
  {
    sourceKey: "uk.sanctions",
    url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv",
    run: async () => {
      const url = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv";
      const r = await get(url);
      const text = r.body.toString("utf8");
      const firstLine = text.slice(0, text.indexOf("\n")).trim();
      const rows = parseCsv(text.slice(text.indexOf("\n") + 1));
      const header = rows[0]!;
      const typeCol = header.indexOf("Designation Type");
      const kept = rows.slice(1).filter((x) => x[typeCol] === "Ship");
      const reportDate = firstLine.replace(/^Report Date:\s*/, "");
      return [{ content: Buffer.from(toCsv([header, ...kept])), file: { name: "uk-sanctions-ships.csv", sourceKey: "uk.sanctions", title: "UK Sanctions List (FCDO) · ship designations", originalUrl: url, mediaType: "text/csv", eventTime: isNaN(Date.parse(reportDate)) ? null : new Date(reportDate).toISOString(), sourceVersion: firstLine, licence: "Open Government Licence v3.0", transformations: [{ step: "filter_rows", detail: "Kept rows with Designation Type 'Ship'. Removed the report-date preamble line (kept as source version).", rowsBefore: rows.length - 1, rowsAfter: kept.length }] } }];
    },
  },
];

/** Portals checked for availability only; their series need manual dataset selection (recorded in the registry). */
const reachabilityOnly = [
  ["gccstat.portal", "https://dp.marsa.gccstat.org/en"],
  ["un.sanctions", "https://scsanctions.un.org/resources/xml/en/consolidated.xml"],
  ["sama.statistics", "https://www.sama.gov.sa/en-US/EconomicReports/Pages/MonthlyStatistics.aspx"],
  ["cbuae.statistics", "https://www.centralbank.ae/en/research-and-statistics/"],
  ["datasaudi.portal", "https://datasaudi.sa/en"],
  ["gastat.portal", "https://www.stats.gov.sa/en"],
  ["bayanat.portal", "https://bayanat.ae/en"],
] as const;

async function main() {
  const keys = collectorKeys();
  const files: PackageFile[] = [];
  const contents: Record<string, string> = {};
  const attempts: CollectionAttempt[] = [];

  for (const c of collectors) {
    try {
      const got = await c.run();
      for (const g of got) {
        const sha = createHash("sha256").update(g.content).digest("hex");
        files.push({ ...g.file, size: g.content.length, sha256: sha, retrievedAt: new Date().toISOString() });
        contents[g.file.name] = g.content.toString("base64");
      }
      attempts.push({ sourceKey: c.sourceKey, url: c.url, outcome: "collected", detail: `${got.length} file(s)` });
      console.log(`collected ${c.sourceKey}: ${got.length} file(s)`);
    } catch (e) {
      attempts.push({ sourceKey: c.sourceKey, url: c.url, outcome: "unreachable", detail: (e as Error).message });
      console.log(`FAILED ${c.sourceKey}: ${(e as Error).message}`);
    }
  }
  for (const [sourceKey, url] of reachabilityOnly) {
    let detail: string;
    try {
      const res = await ufetch(url, { dispatcher: proxy, method: "GET", signal: AbortSignal.timeout(20_000) });
      detail = `HTTP ${res.status}`;
      await res.body?.cancel();
    } catch (e) {
      detail = `no response (${(e as Error).name})`;
    }
    attempts.push({ sourceKey, url, outcome: "skipped", detail: `Availability check only: ${detail}` });
    console.log(`checked ${sourceKey}: ${detail}`);
  }

  const createdAt = new Date().toISOString();
  const manifest: PackageManifest = {
    packageId: randomUUID(), createdAt, sender: "TIGERIS public-data collector (demonstration)", collectorVersion: "0.1.0",
    intendedEnvironment: "controlled_demo", schemaVersion: 1, files, attempts,
  };
  const signature = sign(null, Buffer.from(canonicalJson(manifest)), keys.privateKey).toString("base64");
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: keys.fingerprint, value: signature }, files: contents };
  mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `public-snapshot-${createdAt.slice(0, 10)}.tigpkg`);
  const gz = gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 });
  writeFileSync(out, gz);
  console.log(`wrote ${out} (${(gz.length / 1024).toFixed(0)} KB, ${files.length} files, signer ${keys.fingerprint})`);
}

await main();
