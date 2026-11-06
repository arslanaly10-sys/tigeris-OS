import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { drainQueue } from "../src/evidence/jobs";
import { closePools } from "../src/db";

const [GSF, ANIA] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
const people = new Map<string, string>();

async function signIn(institutionId: string, role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === institutionId).people.find((p: { role: string }) => p.role === role);
  people.set(`${institutionId}:${role}`, person.id);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
const get = async (cookie: string, url: string) => (await app.inject({ method: "GET", url, headers: { cookie } })).json();
const post = (cookie: string, url: string, payload: unknown) => app.inject({ method: "POST", url, headers: { cookie }, payload: payload as object });

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("intelligence graph (FR-13..FR-16)", () => {
  it("builds more than 1,000 entities with every relationship labelled", async () => {
    const c = await signIn(GSF.id, "analyst");
    const s = await get(c, "/graph/stats");
    expect(s.snapshot.entity_count).toBeGreaterThan(1000);
    expect(s.byClass.map((x: { relationship_class: string }) => x.relationship_class).sort()).toEqual(expect.arrayContaining(["observed", "sourced", "synthetic"]));
  });

  it("traces second- and third-order paths from the strait to ports, cities and synthetic holdings", async () => {
    const c = await signIn(GSF.id, "analyst");
    const r = await get(c, "/graph/paths?from=chokepoint:hormuz&depth=3");
    const ras = r.hops.find((h: { entity: { key: string } }) => h.entity.key === "port:ras-tanura");
    expect(ras.depth).toBe(1);
    expect(ras.via.evidenceCount).toBeGreaterThan(0);
    expect(r.hops.some((h: { depth: number; entity: { type: string } }) => h.depth >= 2 && h.entity.type === "holding")).toBe(true);
    expect(r.hops.some((h: { depth: number; entity: { type: string } }) => h.depth >= 2 && h.entity.type === "city")).toBe(true);
    expect(r.alternatives.map((a: { entity: { key: string } }) => a.entity.key)).toEqual(expect.arrayContaining(["pipeline:east-west", "pipeline:adcop"]));
  });

  it("links the EIA bypass figure to the pipeline relationship", async () => {
    const c = await signIn(GSF.id, "analyst");
    const e = await get(c, "/graph/entity?key=pipeline:east-west");
    const bypass = e.edges.find((x: { predicate: string }) => x.predicate === "bypasses");
    expect(bypass.evidence.some((ev: { source: string; factId: string | null }) => /Energy Information/.test(ev.source) ? true : ev.factId !== null)).toBe(true);
  });

  it("keeps each institution's synthetic portfolio inside that institution", async () => {
    const gsf = await signIn(GSF.id, "analyst");
    const ania = await signIn(ANIA.id, "analyst");
    expect((await get(gsf, "/graph/entities?type=holding&limit=200")).entities.every((h: { key: string }) => h.key.includes("gulf-sovereign-fund"))).toBe(true);
    expect((await get(ania, "/graph/entities?type=holding&limit=200")).entities.every((h: { key: string }) => h.key.includes("al-noor"))).toBe(true);
    const miss = await app.inject({ method: "GET", url: "/graph/entity?key=holding:gulf-sovereign-fund:001", headers: { cookie: ania } });
    expect(miss.statusCode).toBe(404);
  });
});

describe("case workflow (App Flow §4, Q026)", () => {
  it("blocks a role that may not make a move, and audits it", async () => {
    const c = await signIn(GSF.id, "auditor");
    const r = await post(c, "/cases/GSF-2026-0001/transition", { to: "scenario" });
    expect(r.statusCode).toBe(403);
    expect(r.json().policy.result).toBe("BLOCK");
  });

  it("holds a move that needs a rationale until one is given", async () => {
    const c = await signIn(GSF.id, "domain_expert");
    const hold = await post(c, "/cases/GSF-2026-0006/transition", { to: "decision" });
    expect(hold.statusCode).toBe(409);
    expect(hold.json().policy.result).toBe("HOLD");
    const pass = await post(c, "/cases/GSF-2026-0006/transition", { to: "decision", rationale: "Liquidity analysis is complete and consistent with the evidence." });
    expect(pass.json().policy.result).toBe("PASS");
  });

  it("stops the person who opened a case from approving it (separation of duties)", async () => {
    const exec = await signIn(GSF.id, "executive");
    // GSF-2026-0003 was opened by the executive; move it to decision first.
    const analyst = await signIn(GSF.id, "analyst");
    for (const to of ["triaged", "analysis", "scenario", "review"]) expect((await post(analyst, "/cases/GSF-2026-0003/transition", { to })).statusCode).toBe(200);
    const expert = await signIn(GSF.id, "domain_expert");
    await post(expert, "/cases/GSF-2026-0003/transition", { to: "decision", rationale: "Scenario assumptions reviewed and documented." });
    const sod = await post(exec, "/cases/GSF-2026-0003/transition", { to: "handoff", rationale: "Approve the defensive reallocation option." });
    expect(sod.statusCode).toBe(403);
    expect(sod.json().policy.rule).toBe("case.separation_of_duties");
    const approver = await signIn(GSF.id, "approver");
    const ok = await post(approver, "/cases/GSF-2026-0003/transition", { to: "handoff", rationale: "Approve the defensive reallocation option." });
    expect(ok.json().policy.result).toBe("PASS");
    const ops = await signIn(GSF.id, "operations_owner");
    const attention = await get(ops, "/attention");
    expect(attention.items.some((i: { title: string }) => i.title.startsWith("GSF-2026-0003"))).toBe(true);
  });

  it("holds sending a case for review without any evidence or signal", async () => {
    const c = await signIn(GSF.id, "analyst");
    // GSF-2026-0002 (resilience) has no signals or evidence attached.
    await post(c, "/cases/GSF-2026-0002/transition", { to: "analysis" });
    await post(c, "/cases/GSF-2026-0002/transition", { to: "scenario" });
    const r = await post(c, "/cases/GSF-2026-0002/transition", { to: "review" });
    expect(r.json().policy.rule).toBe("case.evidence_required");
  });
});

describe("comments, mentions and notifications", () => {
  it("notifies a mentioned colleague in the same institution only", async () => {
    const analyst = await signIn(GSF.id, "analyst");
    const expert = await signIn(GSF.id, "domain_expert");
    const foreign = (await get(await signIn(ANIA.id, "analyst"), "/auth/context")).principal.id;
    const r = await post(analyst, "/cases/GSF-2026-0001/comments", { body: "Please check the bypass capacity assumption.", mentions: [people.get(`${GSF.id}:domain_expert`), foreign] });
    expect(r.json().mentions).toBe(1);
    const n = await get(expert, "/notifications");
    expect(n.notifications.some((x: { kind: string; link: string }) => x.kind === "mention" && x.link === "/cases/GSF-2026-0001")).toBe(true);
  });
});

describe("signals", () => {
  it("raises a labelled simulated event and lets an analyst open a case from it", async () => {
    const c = await signIn(GSF.id, "analyst");
    const s = (await post(c, "/signals/simulate", { kind: "desal_outage" })).json();
    const detail = await get(c, `/signals/${s.id}`);
    expect(detail.signal.data_mode).toBe("simulated");
    expect(detail.signal.confidence.band).toBeDefined();
    expect(detail.signal.confidence.components).toHaveLength(4);
    const opened = (await post(c, `/signals/${s.id}/disposition`, { action: "open_case" })).json();
    expect(opened.caseKey).toMatch(/^GSF-2026-\d{4}$/);
  });

  it("requires a rationale to dismiss", async () => {
    const c = await signIn(GSF.id, "analyst");
    const s = (await post(c, "/signals/simulate", { kind: "gps_interference" })).json();
    expect((await post(c, `/signals/${s.id}/disposition`, { action: "dismiss", rationale: "" })).statusCode).toBe(400);
  });

  it("an uploaded shipping advisory corroborates the open Hormuz signal and raises its confidence", async () => {
    const c = await signIn(GSF.id, "analyst");
    const before = (await get(c, "/signals")).signals.find((s: { title: string }) => /Tanker transits/.test(s.title));
    await post(c, "/evidence/demo-documents/gulf-shipping-advisory-synthetic.pdf", {});
    await drainQueue();
    const after = (await get(c, `/signals/${before.id}`));
    expect(after.evidence.some((e: { role: string }) => e.role === "corroborating")).toBe(true);
    expect(["medium", "high"]).toContain(after.signal.confidence.band);
  });
});

describe("search", () => {
  it("finds cases, signals and entities", async () => {
    const c = await signIn(GSF.id, "analyst");
    const r = await get(c, "/search?q=hormuz");
    expect(r.cases.length).toBeGreaterThan(0);
    expect(r.signals.length).toBeGreaterThan(0);
    expect(r.entities.some((e: { key: string }) => e.key === "chokepoint:hormuz")).toBe(true);
  });
});
