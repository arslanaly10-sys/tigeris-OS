import { existsSync, readFileSync } from "node:fs";
import { createHash, createPrivateKey, createPublicKey, randomUUID, sign } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PACKAGE_FORMAT, canonicalJson, summariseAis, type AisMessage, type TransferPackage } from "@tigeris/shared";
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
    expect(d.vessels).toHaveLength(2);
    const t = d.vessels.find((v: { mmsi: string }) => v.mmsi === "999000001");
    expect([t.name, t.category, t.lat, t.lon]).toEqual(["TEST TANKER", "tanker", 26.45, 56.4]);
    const lineage = (await app.inject({ method: "GET", url: `/facts/${t.facts.position_lat.id}/lineage`, headers: { cookie: analyst } })).json();
    expect(lineage.source.key).toBe("aisstream.hormuz");
    const other = (await app.inject({ method: "GET", url: "/map/observed-vessels", headers: { cookie: await signIn(ANIA.id, "analyst") } })).json();
    expect(other.vessels).toHaveLength(0);
  });
});
