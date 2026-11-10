import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";

// Engagements, rubric v3 and the value model (brief v3 §3, §4, §7.1).
const [GSF, ANIA] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
async function signIn(institutionId: string, role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === institutionId).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
const get = async (c: string, url: string) => (await app.inject({ method: "GET", url, headers: { cookie: c } })).json();
const put = (c: string, url: string, payload: unknown) => app.inject({ method: "PUT", url, headers: { cookie: c }, payload: payload as object });

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("engagements and the 8-gap diagnosis", () => {
  it("seeds Fund A's golden-path engagement, synthetic, with all eight gaps and the composite indices", async () => {
    const A = await signIn(GSF.id, "analyst");
    const { engagements } = await get(A, "/engagements");
    expect(engagements).toHaveLength(1);
    expect(engagements[0]).toMatchObject({ organisation: "GCC Sovereign Fund A", data_mode: "synthetic" });
    const e = await get(A, `/engagements/${engagements[0].id}`);
    expect(e.diagnosis.gaps).toHaveLength(8);
    expect(e.diagnosis.indices.csai).toBeGreaterThan(0);
    expect(e.diagnosis.missing).toEqual(["searchable_knowledge_pct"]);
    expect(e.value.valueAtStakeUsd.base).toBe(2e9); // 2 points of $100B
    expect(e.value.ceilingUsd).toBe(15e9);
    expect((await get(await signIn(ANIA.id, "analyst"), "/engagements")).engagements).toHaveLength(0);
  });
  it("updates scores live in workshop mode and writes every edit to the Ledger", async () => {
    const A = await signIn(GSF.id, "analyst"), U = await signIn(GSF.id, "auditor");
    const id = (await get(A, "/engagements")).engagements[0].id;
    const before = (await get(A, `/engagements/${id}`)).diagnosis;
    const r = await put(A, `/engagements/${id}/inputs/signal_to_owner_days`, { value: 1, note: "Workshop: owner named within a day" });
    expect(r.statusCode).toBe(200);
    expect(r.json().diagnosis.indices.coordinationDebt).toBeLessThan(before.indices.coordinationDebt);
    expect(r.json().diagnosis.indices.csai).toBeGreaterThan(before.indices.csai);
    expect((await put(A, `/engagements/${id}/inputs/searchable_knowledge_pct`, { value: 40, note: "Filled in the workshop" })).json().diagnosis.missing).toEqual([]);
    expect((await put(A, `/engagements/${id}/assumptions/improvement_base`, { value: 0.025 })).statusCode).toBe(200);
    expect((await get(A, `/engagements/${id}`)).value.valueAtStakeUsd.base).toBeCloseTo(2.5e9, 0);
    expect((await put(A, `/engagements/${id}/assumptions/structural_inefficiency`, { value: 0.9 })).statusCode).toBe(400);
    expect((await put(U, `/engagements/${id}/inputs/handoffs`, { value: 3, note: "x" })).statusCode).toBe(403);
    const audit = await withTenant(GSF.id, (tx) => tx.query("SELECT action, details FROM audit_events WHERE action IN ('diagnosis.input_edited','valuation.assumption_edited') ORDER BY seq"));
    expect(audit.rows.map((r) => r.action)).toEqual(["diagnosis.input_edited", "diagnosis.input_edited", "valuation.assumption_edited"]);
    expect(audit.rows[0].details).toMatchObject({ metricId: "signal_to_owner_days", from: 11, to: 1, gap: 1 });
  });
  it("creates an engagement from the intake with empty inputs and low confidence", async () => {
    const E = await signIn(GSF.id, "executive");
    const r = await app.inject({ method: "POST", url: "/engagements", headers: { cookie: E }, payload: { fullName: "Test Person", title: "Director", email: "t@example.invalid", organisation: "Fund B", category: "Sovereign Wealth Fund", jurisdiction: "Qatar", interests: [], posture: "Bilateral Knowledge Exchange", challenge: "Understand our coordination debt.", window: "30 days", format: "Secure Virtual Council", aumUsd: 5e11 } });
    expect(r.statusCode).toBe(200);
    const e = await get(E, `/engagements/${r.json().engagementId}`);
    expect(e.diagnosis.confidence).toBe("low");
    expect(e.diagnosis.indices.csai).toBeNull();
    expect(e.value.valueAtStakeUsd.base).toBe(1e10);
  });
});
