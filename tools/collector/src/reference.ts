/**
 * Writes two signed packages (TR-017):
 *  - reference-geography.tigpkg: curated GCC reference geography (source tigeris.reference)
 *  - synthetic-institution-context.tigpkg: one SYNTHETIC context file per demo institution
 *    (mandates and ~100 holdings), each marked for its own institution only.
 *
 *   pnpm --filter @tigeris/collector reference
 */
import { createHash, randomUUID, sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { PACKAGE_FORMAT, canonicalJson, type PackageFile, type TransferPackage } from "@tigeris/shared";
import { collectorKeys } from "./keys";
import { REFERENCE } from "./reference-data";

const OUT = path.resolve(import.meta.dirname, "../../../data/packages");
const AS_OF = "2026-11-06T00:00:00.000Z";

/** Small deterministic PRNG so the synthetic portfolios are identical on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

interface Holding { key: string; name: string; sector: string; assetClass: string; country: string; valueUsdM: number; exposures: Array<{ entity: string; weight: number; channel: string }>; mandate: string }

const SECTORS: Array<{ sector: string; domain: string; stems: string[]; exposure: string[]; channel: string }> = [
  { sector: "Energy", domain: "energy", stems: ["Crude Marketing", "Upstream Royalty", "Gas Processing", "Tanker Charter", "Refining"], exposure: ["chokepoint:hormuz", "port:ras-tanura", "port:das-island", "refinery:ruwais", "port:ras-laffan", "pipeline:east-west", "facility:abqaiq"], channel: "Revenue depends on export volumes" },
  { sector: "Petrochemicals", domain: "manufacturing", stems: ["Polymers", "Fertiliser", "Aromatics", "Methanol"], exposure: ["port:jubail", "refinery:jubail", "port:ruwais", "port:mesaieed", "commodity:petchem"], channel: "Feedstock and export logistics" },
  { sector: "Logistics", domain: "supply_chain", stems: ["Port Services", "Container Shipping", "Freight Forwarding", "Cold Chain"], exposure: ["port:jebel-ali", "port:khalifa", "port:hamad", "port:dammam", "port:sohar", "port:king-abdullah", "route:red-sea"], channel: "Throughput-linked revenue" },
  { sector: "Banking", domain: "banking", stems: ["Commercial Bank", "Trade Finance", "Islamic Finance", "Payments"], exposure: ["country:SAU", "country:ARE", "country:QAT", "country:KWT", "commodity:crude"], channel: "Credit quality tied to oil revenue" },
  { sector: "Utilities", domain: "infrastructure", stems: ["Water and Power", "Grid Services", "Desalination Holdings", "District Cooling"], exposure: ["desal:ras-al-khair", "desal:taweelah", "power:jebel-ali", "desal:jubail", "power:barakah"], channel: "Regulated asset returns" },
  { sector: "Food and agriculture", domain: "supply_chain", stems: ["Grain Import", "Food Processing", "Agri Storage"], exposure: ["commodity:grain", "port:jebel-ali", "port:dammam", "port:hamad", "port:jeddah"], channel: "Import costs and availability" },
  { sector: "Real estate", domain: "construction_real_estate", stems: ["Urban Development", "Logistics Parks", "Hospitality Assets"], exposure: ["city:riyadh", "city:dubai", "city:doha", "city:jeddah"], channel: "Occupancy and construction input costs" },
  { sector: "Insurance", domain: "insurance", stems: ["Marine Insurance", "Property and Casualty", "Reinsurance"], exposure: ["chokepoint:hormuz", "route:red-sea", "port:fujairah", "chokepoint:bab-el-mandeb"], channel: "Claims and war-risk pricing" },
  { sector: "Aviation", domain: "supply_chain", stems: ["Air Cargo", "Airport Services"], exposure: ["airport:dxb", "airport:doh", "airport:ruh", "refinery:jebel-ali"], channel: "Fuel costs and route access" },
  { sector: "Global equities", domain: "sovereign_capital", stems: ["Asia Industrials Basket", "Europe Consumer Basket", "US Technology Basket"], exposure: ["market:china", "market:europe", "market:usa", "market:japan"], channel: "Market sensitivity to energy prices" },
];
const ASSET_CLASSES = ["Listed equity", "Private equity", "Infrastructure", "Fixed income", "Real estate"];
const PLACES = ["Najd", "Hijaz", "Tihama", "Dhofar", "Batinah", "Liwa", "Hajar", "Asir", "Qassim", "Rub al Khali", "Gulf", "Arabian", "Peninsula", "Khaleej", "Sahel", "Wadi"];

function institutionContext(slug: string, seed: number, country: string, profile: { name: string; mandates: Array<{ key: string; name: string; limit?: string }>; tilt: string[] }) {
  const r = rng(seed);
  const holdings: Holding[] = [];
  for (let i = 0; i < 100; i++) {
    const weighted = r() < 0.45 ? SECTORS.filter((s) => profile.tilt.includes(s.sector)) : SECTORS;
    const s = weighted[Math.floor(r() * weighted.length)]!;
    const stem = s.stems[Math.floor(r() * s.stems.length)]!;
    const place = PLACES[Math.floor(r() * PLACES.length)]!;
    const n = 1 + Math.floor(r() * 3);
    const exps = [...s.exposure].sort(() => r() - 0.5).slice(0, n).map((entity) => ({ entity, weight: Math.round((0.2 + r() * 0.7) * 100) / 100, channel: s.channel }));
    holdings.push({
      key: `holding:${slug}:${String(i + 1).padStart(3, "0")}`, name: `${place} ${stem} ${["Co.", "Holding", "Fund", "Partners"][Math.floor(r() * 4)]} (fictional)`,
      sector: s.sector, assetClass: ASSET_CLASSES[Math.floor(r() * ASSET_CLASSES.length)]!, country: r() < 0.7 ? country : ["SAU", "ARE", "QAT", "KWT", "OMN", "BHR"][Math.floor(r() * 6)]!,
      valueUsdM: Math.round((40 + r() ** 2 * 2400) * 10) / 10, exposures: exps, mandate: profile.mandates[Math.floor(r() * profile.mandates.length)]!.key,
    });
  }
  return { version: `synthetic-${slug}-2026-11-06`, intendedInstitution: slug, note: "SYNTHETIC demonstration context. Fictional holdings and values; not investment data.", institution: { key: `institution:${slug}`, name: profile.name, country }, mandates: profile.mandates, holdings };
}

function writePackage(file: string, files: Array<{ meta: Omit<PackageFile, "size" | "sha256" | "retrievedAt">; json: unknown }>) {
  const keys = collectorKeys();
  const entries: PackageFile[] = [];
  const content: Record<string, string> = {};
  for (const f of files) {
    const buf = Buffer.from(JSON.stringify(f.json));
    entries.push({ ...f.meta, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt: AS_OF });
    content[f.meta.name] = buf.toString("base64");
  }
  const manifest = { packageId: randomUUID(), createdAt: new Date().toISOString(), sender: "TIGERIS reference and fixtures builder (demonstration)", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const, files: entries, attempts: [] };
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: keys.fingerprint, value: sign(null, Buffer.from(canonicalJson(manifest)), keys.privateKey).toString("base64") }, files: content };
  writeFileSync(path.join(OUT, file), gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 }));
  console.log(`wrote ${file}: ${entries.length} file(s)`);
}

writePackage("reference-geography-2026-11-06.tigpkg", [{
  meta: { name: "gcc-reference-geography.json", sourceKey: "tigeris.reference", title: "GCC reference geography and infrastructure (curated)", originalUrl: "", mediaType: "application/json", eventTime: AS_OF, sourceVersion: REFERENCE.version, licence: "Curated for the demonstration from public knowledge; validate against institution GIS", transformations: [] },
  json: REFERENCE,
}]);

const GSF = institutionContext("gulf-sovereign-fund", 7, "SAU", {
  name: "Gulf Sovereign Fund", tilt: ["Energy", "Petrochemicals", "Banking", "Global equities"],
  mandates: [
    { key: "mandate:gsf:preservation", name: "Long-term national wealth preservation", limit: "Drawdown tolerance 15% over 12 months" },
    { key: "mandate:gsf:diversification", name: "Domestic economic diversification", limit: "Non-oil sectors at least 40% of domestic portfolio" },
    { key: "mandate:gsf:energy-transition", name: "Energy transition allocation", limit: "No more than 15% of new commitments" },
    { key: "mandate:gsf:liquidity", name: "Liquidity buffer", limit: "At least 10% in assets liquid within 30 days" },
  ],
});
const ANIA = institutionContext("al-noor-investment-authority", 11, "ARE", {
  name: "Al Noor National Investment Authority", tilt: ["Logistics", "Utilities", "Aviation", "Real estate"],
  mandates: [
    { key: "mandate:ania:infrastructure", name: "National infrastructure resilience", limit: "Critical assets with tested alternatives" },
    { key: "mandate:ania:trade", name: "Trade and logistics leadership", limit: "Port and corridor exposure reviewed quarterly" },
    { key: "mandate:ania:food", name: "Food security reserve", limit: "90 days of staple import cover" },
  ],
});
writePackage("synthetic-institution-context-2026-11-06.tigpkg", [
  { meta: { name: "context-gulf-sovereign-fund.json", sourceKey: "tigeris.synthetic", title: "Synthetic institution context · Gulf Sovereign Fund", originalUrl: "", mediaType: "application/json", eventTime: AS_OF, sourceVersion: GSF.version, licence: "Synthetic demonstration data", transformations: [], intendedInstitution: "gulf-sovereign-fund" }, json: GSF },
  { meta: { name: "context-al-noor-investment-authority.json", sourceKey: "tigeris.synthetic", title: "Synthetic institution context · Al Noor National Investment Authority", originalUrl: "", mediaType: "application/json", eventTime: AS_OF, sourceVersion: ANIA.version, licence: "Synthetic demonstration data", transformations: [], intendedInstitution: "al-noor-investment-authority" }, json: ANIA },
]);
console.log(`reference: ${REFERENCE.entities.length} entities, ${REFERENCE.relationships.length} relationships`);
