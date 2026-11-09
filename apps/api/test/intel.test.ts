import { createHash } from "node:crypto";
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
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: person.id, method: "demo_entry", industry: "defence_security" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
const get = async (c: string, url: string) => (await app.inject({ method: "GET", url, headers: { cookie: c } })).json();

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("voyage anomalies and correlation (slice 4)", () => {
  it("detects the five scripted behaviours and raises a SIMULATED signal for each", async () => {
    const c = await signIn("analyst");
    const d = await get(c, "/anomalies");
    expect(d.anomalies.map((a: { kind: string }) => a.kind).sort()).toEqual(["ais_spoofing", "going_dark", "loitering", "route_deviation", "ship_to_ship"]);
    expect(d.anomalies.every((a: { signalId: string | null; dataMode: string; at: string }) => a.signalId && a.dataMode === "simulated" && Date.parse(a.at) <= Date.now())).toBe(true);
    const signals = (await get(c, "/signals")).signals.filter((s: { detected_by: string }) => s.detected_by === "rule.voyage_anomaly");
    expect(signals).toHaveLength(5);
    expect(signals.every((s: { data_mode: string }) => s.data_mode === "simulated")).toBe(true);
    expect(d.real.assessed).toBe(0);
  });

  it("adds spoofing and the AIS gap to the navigation-safety case", async () => {
    const c = await signIn("analyst");
    const cases = (await get(c, "/cases")).cases;
    const nav = cases.find((x: { title: string }) => x.title === "Navigation safety and AIS spoofing near Hormuz");
    expect(nav.signals).toBe(3);
  });

  it("correlates the Hormuz events into one finding with ranked competing hypotheses", async () => {
    const c = await signIn("analyst");
    const { findings } = await get(c, "/correlation");
    const f = findings.find((x: { area: string }) => x.area === "hormuz");
    expect(f.members.length).toBeGreaterThanOrEqual(6);
    expect(f.hypotheses[0].rank).toBe(1);
    expect(f.hypotheses.at(-1).key).toBe("ordinary");
    // Interference and evasion are equally consistent with these events: the finding must say it cannot separate them.
    const leaders = f.hypotheses.filter((h: { rank: number }) => h.rank === 1);
    if (leaders.length > 1) expect(f.title).toMatch(/cannot yet separate/);
    for (let i = 1; i < f.hypotheses.length; i++) expect(f.hypotheses[i].inconsistent).toBeGreaterThanOrEqual(f.hypotheses[i - 1].inconsistent);
    expect(f.matrix).toHaveLength(f.members.length);
    expect(f.dataModes).toContain("simulated");
    expect(f.confidenceBasis).toMatch(/Analysis of Competing Hypotheses/);
  });

  it("exports a source package whose hash matches, and records the export", async () => {
    const c = await signIn("analyst");
    const f = (await get(c, "/correlation")).findings[0];
    const res = await app.inject({ method: "GET", url: `/correlation/${f.id}/package`, headers: { cookie: c } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("tigeris-source-package");
    expect(createHash("sha256").update(res.body).digest("hex")).toBe(res.headers["x-content-sha256"]);
    const pkg = JSON.parse(res.body);
    expect(pkg.format).toBe("tigeris-source-package/1");
    expect(pkg.members.length).toBe(f.members.length);
    expect(pkg.notice).toMatch(/not a decision/);
    const events = await get(await signIn("auditor"), "/audit/events?limit=20");
    expect(JSON.stringify(events)).toContain("correlation.package_exported");
    expect((await app.inject({ method: "GET", url: "/correlation/nowhere/package", headers: { cookie: c } })).statusCode).toBe(404);
  });
});
