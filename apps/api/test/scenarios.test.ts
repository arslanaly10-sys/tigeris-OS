import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools } from "../src/db";

// Needs the reasoning service on REASONING_URL (default http://localhost:8000).
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

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("scenarios (FR-26, FR-27, TR-035, TR-038)", () => {
  let runs: Array<{ id: string; variant: string; results: Array<{ id: string; key: string; horizon: string; value: number; p10: number; p90: number }>; cascade: unknown[]; resilience: { score: number } }>;

  it("runs a baseline and two alternatives across four horizons", async () => {
    const c = await signIn(GSF.id, "analyst");
    const res = await app.inject({ method: "POST", url: "/cases/GSF-2026-0001/scenarios", headers: { cookie: c }, payload: { variants: [
      { name: "Baseline", drivers: {} },
      { name: "Longer closure", drivers: { duration_days: 90, route_availability_pct: 40 } },
      { name: "Short disruption", drivers: { duration_days: 7 } },
    ] } });
    expect(res.statusCode).toBe(200);
    runs = res.json().runs;
    expect(runs.map((r) => r.variant)).toEqual(["alt1", "alt2", "baseline"].sort());
    const base = runs.find((r) => r.variant === "baseline")!;
    expect(new Set(base.results.map((r) => r.horizon))).toEqual(new Set(["72h", "90d", "1y", "5y"]));
    expect(base.cascade).toHaveLength(151);
    const longer = runs.find((r) => r.variant === "alt1")!;
    const lost = (r: typeof base) => r.results.find((x) => x.key === "cumulative_lost_mb" && x.horizon === "1y")!.value;
    expect(lost(longer)).toBeGreaterThan(lost(base));
    expect(longer.resilience.score).toBeLessThan(base.resilience.score);
  });

  it("every number traces to EIA facts and named assumptions", async () => {
    const c = await signIn(GSF.id, "analyst");
    const r = runs.find((x) => x.variant === "baseline")!.results.find((x) => x.key === "avg_net_shortfall_mbd" && x.horizon === "90d")!;
    const l = (await app.inject({ method: "GET", url: `/scenario-results/${r.id}/lineage`, headers: { cookie: c } })).json();
    expect(l.facts.some((f: { source_name: string }) => /Energy Information/.test(f.source_name) || /chokepoint/i.test(f.source_name))).toBe(true);
    expect(l.assumptions.some((a: { key: string }) => a.key === "driver.route_availability_pct")).toBe(true);
    expect(l.result.formula).toMatch(/bypass/);
  });

  it("replays a stored run and gets identical numbers", async () => {
    const c = await signIn(GSF.id, "auditor");
    const r = (await app.inject({ method: "POST", url: `/scenario-runs/${runs[0]!.id}/replay`, headers: { cookie: c } })).json();
    expect(r.identical).toBe(true);
    expect(r.checked).toBe(25);
  });

  it("auditors cannot run scenarios; other institutions cannot see them", async () => {
    const aud = await signIn(GSF.id, "auditor");
    expect((await app.inject({ method: "POST", url: "/cases/GSF-2026-0001/scenarios", headers: { cookie: aud }, payload: { variants: [{ name: "x", drivers: {} }] } })).statusCode).toBe(403);
    const ania = await signIn(ANIA.id, "analyst");
    expect((await app.inject({ method: "GET", url: `/scenario-results/${runs[0]!.results[0]!.id}/lineage`, headers: { cookie: ania } })).statusCode).toBe(404);
  });

  it("the oil USD 45 case uses the price template and every holding", async () => {
    const c = await signIn(GSF.id, "analyst");
    const res = (await app.inject({ method: "POST", url: "/cases/GSF-2026-0003/scenarios", headers: { cookie: c }, payload: { variants: [{ name: "Oil at USD 45", drivers: {} }] } })).json();
    const rev = res.runs[0].results.find((x: { key: string; horizon: string }) => x.key === "gcc_export_revenue_change_usd" && x.horizon === "1y");
    expect(rev.value).toBeLessThan(0);
  });
});
