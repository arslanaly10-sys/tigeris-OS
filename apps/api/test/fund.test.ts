import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";

const [GSF] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
async function signIn(institutionId: string, role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === institutionId).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
const post = (c: string, url: string) => app.inject({ method: "POST", url, headers: { cookie: c }, payload: {} });

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("fund apps: take a screened deal to committee", () => {
  it("opens a case from a deal that passes, audited and labelled synthetic", async () => {
    const A = await signIn(GSF.id, "analyst");
    const r = await post(A, "/fund/deals/D-101/case");
    expect(r.statusCode).toBe(200);
    const { caseKey } = r.json();
    const c = await withTenant(GSF.id, (tx) => tx.query("SELECT title, state, domain, situation FROM cases WHERE case_key = $1", [caseKey]));
    expect(c.rows[0]).toMatchObject({ title: "Investment committee: Qamar Cold Chain", state: "detected", domain: "sovereign_capital" });
    expect(c.rows[0].situation).toMatch(/Synthetic/);
    const a = await withTenant(GSF.id, (tx) => tx.query("SELECT details FROM audit_events WHERE action = 'case.created' ORDER BY seq DESC LIMIT 1"));
    expect(a.rows[0].details).toMatchObject({ fromDeal: "D-101", dataMode: "synthetic" });
  });
  it("refuses a deal that fails the mandate, an unknown deal, and a role that cannot open cases", async () => {
    const A = await signIn(GSF.id, "analyst"), U = await signIn(GSF.id, "auditor");
    expect((await post(A, "/fund/deals/D-106/case")).statusCode).toBe(409);
    expect((await post(A, "/fund/deals/D-999/case")).statusCode).toBe(404);
    expect((await post(U, "/fund/deals/D-101/case")).statusCode).toBe(403);
  });
});
