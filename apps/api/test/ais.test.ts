import { existsSync, readFileSync } from "node:fs";
import { createHash, createPrivateKey, createPublicKey, randomUUID, sign } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PACKAGE_FORMAT, canonicalJson, summariseAdsb, summariseAis, type AisMessage, type TransferPackage } from "@tigeris/shared";
import { parseAdsbSnapshot } from "../src/evidence/parsers/adsb";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { drainQueue } from "../src/evidence/jobs";
import { parseAisSnapshot } from "../src/evidence/parsers/ais";
import { closePools } from "../src/db";

const KEYS = path.resolve(import.meta.dirname, "../../../data/keys");
const PRIV = path.join(KEYS, "collector-ed25519.key.pem");
const [GSF, ANIA] = DEMO_INSTITUTIONS;
let app: FastifyInstance;

// Test fixture only: two made-up AIS reports with MMSIs that belong to no real ship.
const NOW = new Date().toISOString();
const msgs: AisMessage[] = [
  { MessageType: "PositionReport", MetaData: { MMSI: 999000001, time_utc: `${NOW.slice(0, 10)} ${NOW.slice(11, 19)}.0 +0000 UTC` }, Message: { PositionReport: { Latitude: 26.45, Longitude: 56.4, Sog: 11.8, Cog: 120, TrueHeading: 121, NavigationalStatus: 0 } } },
  { MessageType: "ShipStaticData", MetaData: { MMSI: 999000001 }, Message: { ShipStaticData: { Name: "TEST TANKER", Type: 80, Destination: "TEST PORT", ImoNumber: 0, Dimension: { A: 180, B: 40 }, MaximumStaticDraught: 12.5 } } },
  { MessageType: "PositionReport", MetaData: { MMSI: 999000002, time_utc: `${NOW.slice(0, 10)} ${NOW.slice(11, 19)}.0 +0000 UTC` }, Message: { PositionReport: { Latitude: 26.1, Longitude: 56.6, Sog: 0, Cog: 360, TrueHeading: 511, NavigationalStatus: 1 } } },
];
const snap = summariseAis(msgs, { from: NOW, to: NOW });

// Test fixture only: made-up aircraft with ICAO addresses and callsigns that belong to no real flight.
const air = summariseAdsb([{ now: Date.parse(NOW), ac: [
  { hex: "f00001", flight: "TST101", t: "B77W", lat: 25.3, lon: 55.5, alt_baro: 31000, gs: 470, track: 300, seen_pos: 3 },
  { hex: "f00002", flight: "TST202", t: "A320", lat: 24.4, lon: 54.6, alt_baro: "ground", gs: 0 },
  { hex: "f00003", flight: "A6PRIV", lat: 25.0, lon: 55.0 },
] }], NOW, ["Dubai"]);

function signedPackage(sourceKey: string, name: string, json: unknown): Buffer {
  const pubPem = readFileSync(path.join(KEYS, "collector-ed25519.pub.pem"), "utf8");
  const buf = Buffer.from(JSON.stringify(json));
  const manifest = { packageId: randomUUID(), createdAt: NOW, sender: "test", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const,
    files: [{ name, sourceKey, title: `${sourceKey} (test)`, originalUrl: "https://example.test", mediaType: "application/json", eventTime: NOW, sourceVersion: "test window", licence: "test",
      transformations: [], size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt: NOW }],
    attempts: [{ sourceKey, url: "https://example.test", outcome: "collected" as const, detail: "test" }] };
  const fp = createHash("sha256").update(createPublicKey(pubPem).export({ type: "spki", format: "der" })).digest("hex").slice(0, 32);
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: fp, value: sign(null, Buffer.from(canonicalJson(manifest)), createPrivateKey(readFileSync(PRIV))).toString("base64") }, files: { [name]: buf.toString("base64") } };
  return gzipSync(Buffer.from(JSON.stringify(pkg)));
}

function aisPackage(): Buffer {
  const pubPem = readFileSync(path.join(KEYS, "collector-ed25519.pub.pem"), "utf8");
  const buf = Buffer.from(JSON.stringify(snap));
  const name = "ais-hormuz-snapshot.json";
  const manifest = { packageId: randomUUID(), createdAt: NOW, sender: "test", collectorVersion: "0.1.0", intendedEnvironment: "controlled_demo", schemaVersion: 1 as const,
    files: [{ name, sourceKey: "aisstream.hormuz", title: "Observed vessels (test)", originalUrl: "https://aisstream.io", mediaType: "application/json", eventTime: NOW, sourceVersion: "test window", licence: "test",
      transformations: [], size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), retrievedAt: NOW }],
    attempts: [{ sourceKey: "aisstream.hormuz", url: "wss://stream.aisstream.io/v0/stream", outcome: "collected" as const, detail: "test" }] };
  const fp = createHash("sha256").update(createPublicKey(pubPem).export({ type: "spki", format: "der" })).digest("hex").slice(0, 32);
  const pkg: TransferPackage = { format: PACKAGE_FORMAT, manifest, signature: { algorithm: "ed25519", keyFingerprint: fp, value: sign(null, Buffer.from(canonicalJson(manifest)), createPrivateKey(readFileSync(PRIV))).toString("base64") }, files: { [name]: buf.toString("base64") } };
  return gzipSync(Buffer.from(JSON.stringify(pkg)));
}

async function signIn(institutionId: string, role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === institutionId).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("observed AIS vessels (FR-30, Q086)", () => {
  it("parses one observed fact per reported field, skipping fields the ship did not report", () => {
    const { facts } = parseAisSnapshot(Buffer.from(JSON.stringify(snap)));
    expect(facts.every((f) => f.claimClass === "observed")).toBe(true);
    const anchored = facts.filter((f) => f.subject === "vessel:mmsi:999000002").map((f) => f.predicate);
    expect(anchored).toEqual(expect.arrayContaining(["position_lat", "position_lon", "speed_over_ground", "nav_status"]));
    expect(anchored).not.toContain("heading");
    expect(facts.find((f) => f.predicate === "vessels_observed")!.valueNum).toBe(2);
  });

  it.skipIf(!existsSync(PRIV))("imports a signed AIS package and serves vessels with lineage, inside one institution only", async () => {
    const admin = await signIn(GSF.id, "administrator");
    const res = await app.inject({ method: "POST", url: "/sources/packages", headers: { cookie: admin, "content-type": "application/octet-stream", "x-file-name": "ais-hormuz-test.tigpkg" }, payload: aisPackage() });
    expect(res.statusCode).toBeLessThan(300);
    await drainQueue();
    const analyst = await signIn(GSF.id, "analyst");
    const d = (await app.inject({ method: "GET", url: "/map/observed-vessels", headers: { cookie: analyst } })).json();
    expect(d.capture).not.toBeNull();
    expect(d.vessels.filter((v: { mmsi: string }) => v.mmsi.startsWith("999"))).toHaveLength(2);
    const t = d.vessels.find((v: { mmsi: string }) => v.mmsi === "999000001");
    expect([t.name, t.category, t.lat, t.lon]).toEqual(["TEST TANKER", "tanker", 26.45, 56.4]);
    const lineage = (await app.inject({ method: "GET", url: `/facts/${t.facts.position_lat.id}/lineage`, headers: { cookie: analyst } })).json();
    expect(lineage.source.key).toBe("aisstream.hormuz");
    const other = (await app.inject({ method: "GET", url: "/map/observed-vessels", headers: { cookie: await signIn(ANIA.id, "analyst") } })).json();
    // The other institution may hold its own bundled snapshot, but never this institution's uploaded ships.
    expect(other.vessels.some((v: { mmsi: string }) => v.mmsi.startsWith("999"))).toBe(false);
  });

  it("keeps airline flights only and parses one observed fact per reported field", () => {
    expect(air.aircraft.map((a) => a.callsign)).toEqual(["TST101", "TST202"]);
    const { facts } = parseAdsbSnapshot(Buffer.from(JSON.stringify(air)));
    expect(facts.every((f) => f.claimClass === "observed")).toBe(true);
    expect(facts.find((f) => f.predicate === "aircraft_observed")!.valueNum).toBe(2);
    expect(facts.filter((f) => f.subject === "aircraft:f00002").map((f) => f.predicate)).toContain("on_ground");
  });

  it.skipIf(!existsSync(PRIV))("imports a signed ADS-B package and serves aircraft with lineage", async () => {
    const admin = await signIn(GSF.id, "administrator");
    const res = await app.inject({ method: "POST", url: "/sources/packages", headers: { cookie: admin, "content-type": "application/octet-stream", "x-file-name": "adsb-gulf-test.tigpkg" }, payload: signedPackage("adsb.gulf", "adsb-gulf-snapshot.json", air) });
    expect(res.statusCode).toBeLessThan(300);
    await drainQueue();
    const analyst = await signIn(GSF.id, "analyst");
    const d = (await app.inject({ method: "GET", url: "/map/observed-aircraft", headers: { cookie: analyst } })).json();
    const t = d.aircraft.find((a: { callsign: string }) => a.callsign === "TST101");
    expect([t.kind, t.lat, t.lon]).toEqual(["airliner_wide", 25.3, 55.5]);
    const lineage = (await app.inject({ method: "GET", url: `/facts/${t.facts.altitude_ft.id}/lineage`, headers: { cookie: analyst } })).json();
    expect(lineage.source.key).toBe("adsb.gulf");
  });

  it.skipIf(!existsSync(PRIV))("runs the voyage detectors on real AIS tracks and feeds correlation as observed evidence", async () => {
    // Test fixture only: a made-up MMSI whose track has a 2-hour AIS gap and two position jumps near Hormuz.
    const base = Date.now() - 5 * 3_600_000;
    const at = (min: number) => { const d = new Date(base + min * 60_000).toISOString(); return `${d.slice(0, 10)} ${d.slice(11, 19)}.0 +0000 UTC`; };
    const track: AisMessage[] = [];
    for (let m = 0; m <= 300; m += 6) {
      if (m > 60 && m < 186) continue;
      let lon = 56.2 + m * 0.002, lat = 26.3;
      if (m === 240) { lon += 0.5; }
      track.push({ MessageType: "PositionReport", MetaData: { MMSI: 999000077, time_utc: at(m) }, Message: { PositionReport: { Latitude: lat, Longitude: lon, Sog: 11, Cog: 90, TrueHeading: 90, NavigationalStatus: 0 } } });
    }
    track.push({ MessageType: "ShipStaticData", MetaData: { MMSI: 999000077 }, Message: { ShipStaticData: { Name: "TEST TRACKER", Type: 80 } } });
    // A second made-up MMSI with the same gap, but sailing along the southern edge of the box: it was outside, not dark.
    for (let m = 0; m <= 300; m += 6) {
      if (m > 60 && m < 186) continue;
      track.push({ MessageType: "PositionReport", MetaData: { MMSI: 999000078, time_utc: at(m) }, Message: { PositionReport: { Latitude: 24.63, Longitude: 55.2 + m * 0.002, Sog: 11, Cog: 90, TrueHeading: 90, NavigationalStatus: 0 } } });
    }
    const snap2 = summariseAis(track, { from: new Date(base).toISOString(), to: new Date(base + 300 * 60_000).toISOString() });
    expect(snap2.vessels.find((v) => v.mmsi === "999000077")!.track!.length).toBeGreaterThan(20);
    const admin = await signIn(GSF.id, "administrator");
    const up = await app.inject({ method: "POST", url: "/sources/packages", headers: { cookie: admin, "content-type": "application/octet-stream", "x-file-name": "ais-hormuz-track-test.tigpkg" }, payload: signedPackage("aisstream.hormuz", "ais-hormuz-snapshot.json", { ...snap2, capturedTo: new Date().toISOString() }) });
    expect(up.statusCode).toBeLessThan(300);
    await drainQueue();
    const analyst = await signIn(GSF.id, "analyst");
    const d = (await app.inject({ method: "GET", url: "/anomalies", headers: { cookie: analyst } })).json();
    const kinds = d.real.anomalies.map((a: { kind: string }) => a.kind).sort();
    expect(kinds).toEqual(["ais_spoofing", "going_dark"]);
    expect(d.real.assessed).toBeGreaterThanOrEqual(1);
    expect(d.real.anomalies.every((a: { dataMode: string; names: string[] }) => a.dataMode === "observed" && a.names[0] === "TEST TRACKER")).toBe(true);
    // Near Hormuz a real gap may be lost receiver coverage: it is low confidence and says so.
    const gap = d.real.anomalies.find((a: { kind: string }) => a.kind === "going_dark");
    expect(gap.confidence).toBe("low");
    expect(gap.summary).toMatch(/coverage gap/);
    const ves = (await app.inject({ method: "GET", url: "/map/observed-vessels", headers: { cookie: analyst } })).json();
    expect(ves.vessels.find((v: { mmsi: string }) => v.mmsi === "999000077").track.length).toBeGreaterThan(20);
    const f = (await app.inject({ method: "GET", url: "/correlation", headers: { cookie: analyst } })).json().findings.find((x: { area: string }) => x.area === "hormuz");
    expect(f.dataModes).toContain("observed");
    const sig = (await app.inject({ method: "GET", url: "/signals", headers: { cookie: analyst } })).json();
    expect(JSON.stringify(sig)).not.toMatch(/Going dark: TEST TRACKER/);
  });
});
