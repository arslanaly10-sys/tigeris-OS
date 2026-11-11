import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";

const [GSF, ANIA] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
async function signIn(role: string, inst: { id: string } = GSF): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === inst.id).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: inst.id, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("sector Command Centres (Command Centres brief, phase 2)", () => {
  it("returns only this sector's cases and signals, each with its data mode", async () => {
    const cookie = await signIn("analyst");
    const r = (await app.inject({ method: "GET", url: "/sectors/supply_chain", headers: { cookie } })).json();
    expect(r.cases.length).toBeGreaterThan(0);
    const all = await withTenant(GSF.id, (tx) => tx.query("SELECT case_key FROM cases WHERE domain = 'supply_chain' AND state <> 'closed'"));
    expect(r.counts.openCases).toBe(all.rowCount);
    for (const s of r.signals) expect(["observed", "simulated", "synthetic"]).toContain(s.data_mode);
    const keys = new Set(all.rows.map((x) => x.case_key));
    for (const c of r.cases) expect(keys.has(c.case_key)).toBe(true);
  });
  it("opens an audited case from a card, in that sector, at 'detected'", async () => {
    const cookie = await signIn("analyst");
    const res = await app.inject({ method: "POST", url: "/sectors/energy/cases", headers: { cookie }, payload: { title: "Export route risk assessment", objective: "Assess potential disruptions across key maritime routes", card: "Priority Intelligence Cases" } });
    expect(res.statusCode).toBe(200);
    const key = res.json().caseKey;
    const row = await withTenant(GSF.id, (tx) => tx.query("SELECT domain, state FROM cases WHERE case_key = $1", [key]));
    expect(row.rows[0]).toEqual({ domain: "energy", state: "detected" });
    const audit = await withTenant(GSF.id, (tx) => tx.query("SELECT details FROM audit_events WHERE action = 'case.created' ORDER BY seq DESC LIMIT 1"));
    expect(audit.rows[0].details).toMatchObject({ caseKey: key, fromCommandCentre: "energy" });
    // Another institution never sees it.
    const other = (await app.inject({ method: "GET", url: "/sectors/energy", headers: { cookie: await signIn("analyst", ANIA) } })).json();
    expect(other.cases.map((c: { case_key: string }) => c.case_key)).not.toContain(key);
  });
  it("refuses unknown sectors and roles that cannot open cases", async () => {
    expect((await app.inject({ method: "GET", url: "/sectors/nope", headers: { cookie: await signIn("analyst") } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/sectors/energy/cases", headers: { cookie: await signIn("auditor") }, payload: { title: "x y z", card: "c" } })).statusCode).toBe(403);
  });
});
