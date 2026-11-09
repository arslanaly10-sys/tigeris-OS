import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools } from "../src/db";

const [GSF] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
async function signIn(role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === GSF.id).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("sovereignty module (slice 3)", () => {
  it("reports six layers, each with live checks and a status that follows from them", async () => {
    const d = (await app.inject({ method: "GET", url: "/sovereignty", headers: { cookie: await signIn("analyst") } })).json();
    expect(d.layers.map((l: { key: string }) => l.key)).toEqual(["compute", "data", "models", "keys", "applications", "people"]);
    for (const l of d.layers as Array<{ status: string; checks: Array<{ status: string }> }>) {
      const expected = l.checks.some((c) => c.status === "fail") ? "at_risk" : l.checks.every((c) => c.status === "pass") ? "sovereign" : "partial";
      expect(l.status).toBe(expected);
    }
    expect(d.summary.sovereign + d.summary.partial + d.summary.atRisk).toBe(6);
    const data = d.layers.find((l: { key: string }) => l.key === "data");
    expect(data.checks.find((c: { label: string }) => c.label.startsWith("Each institution")).status).toBe("pass");
  });

  it("never shows missing capabilities as working: HSM, confidential computing, PQC and encryption at rest are planned", async () => {
    const d = (await app.inject({ method: "GET", url: "/sovereignty", headers: { cookie: await signIn("executive") } })).json();
    const all = d.layers.flatMap((l: { checks: Array<{ label: string; status: string }> }) => l.checks);
    for (const label of ["Confidential computing (data protected while in use)", "Encryption at rest", "Keys held in a hardware security module", "Post-quantum readiness"]) {
      expect(all.find((c: { label: string }) => c.label === label)?.status, label).toBe("planned");
    }
    expect(d.planned.map((p: { name: string }) => p.name)).toEqual(["Hardware security module (HSM)", "Encryption at rest", "Confidential computing", "Post-quantum cryptography"]);
    expect(d.planned.every((p: { needs: string[] }) => p.needs.length >= 3)).toBe(true);
  });

  it("inventories the cryptography in use, with the signer fingerprint from the trusted signer record", async () => {
    const d = (await app.inject({ method: "GET", url: "/sovereignty", headers: { cookie: await signIn("auditor") } })).json();
    const signer = d.keys.find((k: { name: string }) => k.name === "Collector signing key");
    expect(signer.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(signer.quantumSafe).toBe(false);
    expect(d.keys.find((k: { name: string }) => k.name === "Audit chain").fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
