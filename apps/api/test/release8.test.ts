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
const get = async (c: string, url: string) => (await app.inject({ method: "GET", url, headers: { cookie: c } })).json();
const post = (c: string, url: string, payload: unknown = {}) => app.inject({ method: "POST", url, headers: { cookie: c }, payload: payload as object });

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("back-test and calibration (TR-039, Q050)", () => {
  let id = "";
  it("imports real Brent prices and assumed episodes with lineage", async () => {
    const A = await signIn("analyst");
    const d = await get(A, "/backtests");
    expect(d.available.length).toBe(4);
    expect(d.available.every((e: { prices: number }) => e.prices >= 40)).toBe(true);
  });
  it("fits the price response, beats the prior assumption and keeps fact ids per episode", async () => {
    const A = await signIn("analyst");
    const r = (await post(A, "/backtests")).json();
    id = r.id;
    expect(r.metrics.episodes).toBe(4);
    expect(r.fitted.response_pct_per_pct).toBeGreaterThan(0);
    expect(r.metrics.mae_pp).toBeLessThan(r.metrics.prior_mae_pp);
    expect(r.episodes.every((e: { fact_ids: string[]; assumption_fact_ids: string[] }) => e.fact_ids.length === 13 && e.assumption_fact_ids.length === 2)).toBe(true);
    const again = (await post(A, "/backtests")).json();
    expect(again.input_hash).toBe(r.input_hash);
    expect(again.fitted).toEqual(r.fitted);
  });
  it("needs a different domain expert to adopt, then scenarios use it with its basis", async () => {
    const A = await signIn("analyst"), X = await signIn("domain_expert");
    expect((await post(A, `/backtests/${id}/adopt`, { reason: "my own run" })).statusCode).toBe(403);
    expect((await post(X, `/backtests/${id}/adopt`, { reason: "Fit beats the prior in aggregate" })).statusCode).toBe(200);
    const runs = (await post(A, "/cases/GSF-2026-0001/scenarios", { variants: [{ name: "Calibrated baseline", drivers: {} }] })).json().runs;
    const resultId = runs[0].results.find((r: { key: string; horizon: string }) => r.key === "avg_oil_price_usd" && r.horizon === "72h").id;
    const lin = await get(A, `/scenario-results/${resultId}/lineage`);
    const param = lin.assumptions.find((a: { key: string }) => a.key === "param.price_premium_usd_per_pct");
    expect(param.basis).toMatch(/^Calibrated by back-test/);
  });
});

describe("reports and architecture (Q044, Q057)", () => {
  it("lists reports with the governance summary and live architecture figures", async () => {
    const E = await signIn("executive");
    const r = await get(E, "/reports");
    expect(r.governance.policy.rules).toBeGreaterThan(20);
    expect(r.backtests.length).toBeGreaterThan(0);
    const s = await get(E, "/architecture/stats");
    expect(s.entities).toBeGreaterThan(1000);
    expect(s.agents).toBe(10);
    expect(s.foreignModels).toBe(false);
  });
});
