import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";
import { compile, evaluate, runTests } from "../src/policy/engine";
import { DEFAULT_POLICY } from "../src/policy/default-policy";

// Needs the reasoning service. Semantic search needs the local embedding model; keyword search does not.
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
const post = (c: string, url: string, payload: unknown = {}) => app.inject({ method: "POST", url, headers: { cookie: c }, payload: payload as object });
const audit = (inst: string) => withTenant(inst, (tx) => tx.query("SELECT action, details FROM audit_events ORDER BY seq")).then((r) => r.rows as Array<{ action: string; details: Record<string, unknown> }>);

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("policy engine (FR-29..FR-32, Q090..Q095)", () => {
  it("compiles the default policy and passes its own tests", () => {
    const c = compile(DEFAULT_POLICY);
    expect(c.ok).toBe(true);
    expect(runTests(c.policy!, c.hash).every((t) => t.pass)).toBe(true);
  });
  it("reports YAML and schema errors by location", () => {
    expect(compile("title: x\n  rules: : :").errors[0]).toMatch(/^YAML/);
    expect(compile("title: x\nrules: [{ id: Bad }]\nredaction: { audiences: [] }").errors.join(" ")).toMatch(/rules\.0\.id/);
  });
  it("lets BLOCK win over HOLD and resolves $references", () => {
    const c = compile(DEFAULT_POLICY);
    const e = evaluate(c.policy!, "case.transition", { from: "decision", to: "handoff", actor: { id: "a", role: "approver" }, case: { created_by: "a" }, transition: { needs_rationale: true }, rationale: { length: 0 }, decision: { status: "none" } }, { hash: c.hash, version: 1 });
    expect(e.result).toBe("BLOCK");
    expect(e.trace.filter((t) => !t.passed).map((t) => t.rule)).toEqual(expect.arrayContaining(["case.separation_of_duties", "case.rationale_required", "case.decision_before_handoff"]));
  });
});

describe("policy versions", () => {
  it("refuses to save a broken policy and to activate one whose tests fail; activates a passing one", async () => {
    const admin = await signIn(GSF.id, "administrator");
    expect((await post(admin, "/policy/drafts", { source: "title: [", note: "broken" })).statusCode).toBe(400);
    const weakened = DEFAULT_POLICY.replace("require: { actor.id: { not_equals: $case.created_by } }", "require: { actor.role: { in: [approver, executive] } }");
    const d1 = (await post(admin, "/policy/drafts", { source: weakened, note: "Relax creator rule" })).json();
    expect(d1.tests.some((t: { pass: boolean }) => !t.pass)).toBe(true);
    const refused = await post(admin, `/policy/versions/${d1.id}/activate`, { reason: "Try it anyway" });
    expect(refused.statusCode).toBe(409);
    const changed = DEFAULT_POLICY.replace("A decision needs a rationale of at least 20 characters.", "A decision needs a written rationale of at least 20 characters.");
    const d2 = (await post(admin, "/policy/drafts", { source: changed, note: "Clarify wording" })).json();
    const ok = await post(admin, `/policy/versions/${d2.id}/activate`, { reason: "Clearer message for approvers" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ version: 3, previous: 1, changed: ["decision.rationale"] });
    const analyst = await signIn(GSF.id, "analyst");
    expect((await post(analyst, "/policy/drafts", { source: changed, note: "x" })).statusCode).toBe(403);
    expect((await audit(GSF.id)).map((a) => a.action)).toEqual(expect.arrayContaining(["policy.draft_saved", "policy.activation_refused", "policy.activated"]));
  });
});

describe("decisions, approvals, handoff, drift and replay (FR-33..FR-36, FR-43, Q096..Q101)", () => {
  let decisionId = "";
  it("takes a case from analysis to a two-person decision and a completed handoff", async () => {
    const A = await signIn(GSF.id, "analyst"), X = await signIn(GSF.id, "domain_expert"), P = await signIn(GSF.id, "approver"), E = await signIn(GSF.id, "executive"), O = await signIn(GSF.id, "operations_owner");
    const K = "/cases/GSF-2026-0001";
    await post(A, `${K}/analysis`, { provider: "deterministic" });
    for (let i = 0; i < 120 && (await get(A, `${K}/analysis`)).run.status === "running"; i++) await new Promise((r) => setTimeout(r, 500));
    for (const to of ["scenario", "review"]) expect((await post(A, `${K}/transition`, { to })).json().policy.result).toBe("PASS");
    await post(X, `${K}/transition`, { to: "decision", rationale: "Assumptions and challenges reviewed." });
    const opts = (await get(P, `${K}/decision`)).options as Array<{ id: string; option_key: string; approval: { required: number } }>;
    const board = opts.find((o) => o.approval.required === 2)!;
    expect((await post(A, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "x".repeat(30) })).statusCode).toBe(403);
    const r = (await post(P, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "Keeps national tankers moving at capped premiums." })).json();
    expect(r).toMatchObject({ decisionStatus: "pending", required: 2, handoffs: 0 });
    decisionId = r.decisionId;
    // The same person cannot give the second approval.
    expect((await post(P, `/decisions/${decisionId}/approvals`, { vote: "approve", rationale: "again" })).statusCode).toBe(403);
    expect((await post(P, `${K}/transition`, { to: "handoff", rationale: "Hand off before approval." })).json().policy.rule).toBe("case.decision_before_handoff");
    const second = (await post(E, `/decisions/${decisionId}/approvals`, { vote: "approve", rationale: "Contingent liability acceptable." })).json();
    expect(second).toMatchObject({ decisionStatus: "approved", approvals: 2, handoffs: 3 });
    expect((await post(P, `${K}/transition`, { to: "handoff", rationale: "Approved by two people; hand off." })).json().policy.result).toBe("PASS");
    expect((await post(O, `${K}/transition`, { to: "closed", rationale: "Outcome is recorded now." })).json().policy.rule).toBe("case.handoff_complete_before_close");
    const handoffs = (await get(O, `${K}/decision`)).handoffs as Array<{ id: string }>;
    expect((await post(O, `/handoffs/${handoffs[0]!.id}/updates`, { status: "done", note: "ok" })).statusCode).toBe(409);
    for (const h of handoffs) expect((await post(O, `/handoffs/${h.id}/updates`, { status: "done", note: "Completed with the counterparty." })).statusCode).toBe(200);
    expect((await post(O, `${K}/transition`, { to: "closed", rationale: "Facility in place; exposure reduced." })).json().policy.result).toBe("PASS");
  });

  it("finds no drift right after the decision and replays it identically", async () => {
    const E = await signIn(GSF.id, "executive");
    const drift = await get(E, `/decisions/${decisionId}/drift`);
    expect(drift.overall).toBe("none");
    const replay = (await post(E, `/decisions/${decisionId}/replay`)).json();
    expect(replay.checks.map((c: { ok: boolean }) => c.ok)).toEqual(replay.checks.map(() => true));
    expect(replay.identical).toBe(true);
  });

  it("keeps the audit chain intact through agent runs, decisions and approvals", async () => {
    const aud = await signIn(GSF.id, "auditor");
    expect((await post(aud, "/audit/verify")).json().ok).toBe(true);
  });
});

describe("redacted export (FR-46, Q100)", () => {
  it("applies the policy's audiences: partner needs an executive and withholds holdings and people", async () => {
    const A = await signIn(GSF.id, "analyst"), E = await signIn(GSF.id, "executive");
    const url = "/cases/GSF-2026-0001/brief.pdf";
    expect((await app.inject({ method: "GET", url: `${url}?audience=partner`, headers: { cookie: A } })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `${url}?audience=nope`, headers: { cookie: E } })).statusCode).toBe(400);
    for (const audience of ["internal", "board", "partner"]) expect((await app.inject({ method: "GET", url: `${url}?audience=${audience}`, headers: { cookie: E } })).statusCode).toBe(200);
    const exports = (await audit(GSF.id)).filter((a) => a.action === "export.created");
    const byAud = Object.fromEntries(exports.map((e) => [e.details.audience, e.details.redactions as number]));
    expect(byAud.internal).toBe(0);
    expect(byAud.board).toBeGreaterThan(0);
    expect(byAud.partner).toBeGreaterThan(byAud.board!);
    expect((await audit(GSF.id)).some((a) => a.action === "export.refused")).toBe(true);
  });
});

describe("institutional memory (FR-41, FR-42, Q102..Q104)", () => {
  it("has about fifty labelled precedents and finds them by keyword and by meaning", async () => {
    const A = await signIn(GSF.id, "analyst");
    const m = await get(A, "/memory");
    expect(m.stats.reduce((s: number, x: { n: number }) => s + x.n, 0)).toBeGreaterThanOrEqual(48);
    const r = await get(A, "/memory/search?q=what+happened+when+tankers+were+attacked+near+the+strait");
    expect(r.hits.length).toBeGreaterThan(2);
    expect(r.hits[0].title).toMatch(/tanker/i);
    if (r.semantic) expect(r.hits.some((h: { matchedBy: string[] }) => h.matchedBy.includes("meaning"))).toBe(true);
  });
  it("adds an approved case record to memory only after a different approver accepts it", async () => {
    const A = await signIn(GSF.id, "analyst"), P = await signIn(GSF.id, "approver");
    const draft = (await get(A, "/cases/GSF-2026-0001/precedents")).draft;
    const id = (await post(A, "/cases/GSF-2026-0001/memory", { title: draft.title, summary: draft.summary, outcome: draft.outcome, lessons: draft.lessons.length ? draft.lessons : ["Pre-approve facility terms"] })).json().id;
    expect((await post(A, `/memory/${id}/review`, { approve: true, reason: "mine" })).statusCode).toBe(403);
    expect((await post(P, `/memory/${id}/review`, { approve: true, reason: "Accurate record." })).json().status).toBe("approved");
    const r = await get(A, "/memory/search?q=war-risk+insurance+facility+for+national+tankers");
    expect(r.hits.some((h: { id: string }) => h.id === id)).toBe(true);
  });
  it("keeps one institution's memory away from the other", async () => {
    const other = await signIn(ANIA.id, "analyst");
    const r = await get(other, "/memory/search?q=war-risk+insurance+facility+for+national+tankers");
    expect(r.hits.every((h: { case_id: string | null }) => h.case_id === null)).toBe(true);
  });
});

describe("security posture (Q107)", () => {
  it("reports no failing check", async () => {
    const E = await signIn(GSF.id, "executive");
    const d = await get(E, "/security/posture");
    expect(d.checks.filter((c: { status: string }) => c.status === "fail")).toEqual([]);
    expect(d.checks.length).toBeGreaterThan(15);
  });
});
