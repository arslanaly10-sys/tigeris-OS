import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";

// Decision envelopes (FR-34, FR-35, TR-046). Needs the reasoning service for the case analysis.
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
const envelope = (maxVarUsd: number, name = "Test envelope") => ({ name, mandate: "Continuity of energy exports within the board's appetite.", domain: "energy", authority: "Board investment committee", maxVarUsd, authoriserRoles: ["approver"], validDays: 30 });

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("decision envelopes", () => {
  it("seeds one synthetic, active envelope per institution, activated by a second person", async () => {
    const E = await signIn(GSF.id, "executive");
    const { envelopes } = await get(E, "/envelopes");
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]).toMatchObject({ status: "active", data_mode: "synthetic", domain: "energy", expired: false });
    expect(envelopes[0].activated_by).not.toBe(envelopes[0].proposed_by);
    // Tenant isolation: the other institution sees only its own.
    const other = (await get(await signIn(ANIA.id, "executive"), "/envelopes")).envelopes;
    expect(other.map((e: { id: string }) => e.id)).not.toContain(envelopes[0].id);
  });

  it("needs an executive to propose and a different person to activate", async () => {
    const E = await signIn(GSF.id, "executive"), P = await signIn(GSF.id, "approver"), A = await signIn(GSF.id, "analyst");
    expect((await post(A, "/envelopes", envelope(1e9))).statusCode).toBe(403);
    expect((await post(P, "/envelopes", envelope(1e9))).json().policy.rule).toBe("envelope.propose_authority");
    const id = (await post(E, "/envelopes", envelope(1e9, "Two-person check"))).json().envelopeId;
    const self = await post(E, `/envelopes/${id}/activate`, { note: "Activating my own envelope." });
    expect(self.statusCode).toBe(403);
    expect(self.json().policy.rule).toBe("envelope.activate_distinct_person");
    expect((await post(P, `/envelopes/${id}/activate`, { note: "Committee approved on 9 November." })).statusCode).toBe(200);
    expect((await post(P, `/envelopes/${id}/activate`, { note: "Committee approved again." })).json().policy.rule).toBe("envelope.activate_proposed_only");
    expect((await post(P, `/envelopes/${id}/revoke`, { reason: "Superseded by the next envelope." })).statusCode).toBe(200);
    expect((await get(E, "/envelopes")).envelopes.find((e: { id: string }) => e.id === id).status).toBe("revoked");
    const actions = (await audit(GSF.id)).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["envelope.proposed", "envelope.refused", "envelope.activated", "envelope.revoked"]));
  });

  it("lets one authoriser approve a board option inside the envelope, and sends one outside it to the committee", async () => {
    const A = await signIn(GSF.id, "analyst"), X = await signIn(GSF.id, "domain_expert"), P = await signIn(GSF.id, "approver"), E = await signIn(GSF.id, "executive");
    const K = "/cases/GSF-2026-0001";
    await post(A, `${K}/analysis`, { provider: "deterministic" });
    for (let i = 0; i < 120 && (await get(A, `${K}/analysis`)).run.status === "running"; i++) await new Promise((r) => setTimeout(r, 500));
    for (const to of ["scenario", "review"]) await post(A, `${K}/transition`, { to });
    await post(X, `${K}/transition`, { to: "decision", rationale: "Assumptions and challenges reviewed." });
    type Opt = { id: string; var_with: number; governance: string; band: string; approval: { required: number }; envelopes: Array<{ id: string; name: string; fit: { result: string; rule: string } }> };
    const opts = (await get(P, `${K}/decision`)).options as Opt[];
    const board = opts.find((o) => o.approval.required === 2 && o.governance === "PASS" && o.band !== "low")!;
    expect(board).toBeTruthy();
    const v = Math.abs(board.var_with);
    // The seeded envelope is previewed on every option.
    expect(board.envelopes[0]!.name).toBe("Energy continuity, board items");

    const tight = (await post(E, "/envelopes", envelope(v / 2, "Too tight"))).json().envelopeId;
    const fits = (await post(E, "/envelopes", envelope(v * 1.1, "Fits"))).json().envelopeId;
    for (const id of [tight, fits]) await post(P, `/envelopes/${id}/activate`, { note: "Committee approved for this test." });

    const out = await post(P, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "Keeps national tankers moving at capped premiums.", envelopeId: tight });
    expect(out.statusCode).toBe(403);
    expect(out.json().policy.rule).toBe("envelope.fit_size");
    // The executive is not named as an authoriser in this envelope.
    expect((await post(E, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "Keeps national tankers moving at capped premiums.", envelopeId: fits })).json().policy.rule).toBe("envelope.fit_authoriser");

    const r = (await post(P, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "Inside the committee's envelope; keeps tankers moving.", envelopeId: fits })).json();
    expect(r).toMatchObject({ decisionStatus: "approved", required: 1, handoffs: 3, envelope: "Fits" });
    const d = (await get(P, `${K}/decision`)).decisions[0];
    expect(d).toMatchObject({ envelope_name: "Fits", approval_rule: "envelope:Fits", required_approvals: 1 });
    const rec = (await audit(GSF.id)).filter((a) => a.action === "decision.recorded").at(-1)!;
    expect(rec.details.envelope).toMatchObject({ name: "Fits" });
    expect((await get(E, "/envelopes")).envelopes.find((e: { id: string }) => e.id === fits).uses).toBe(1);
    // One live decision per case: a second one is refused.
    expect((await post(E, `${K}/decisions`, { recommendationId: board.id, outcome: "approve", rationale: "A second decision on the same case." })).statusCode).toBe(409);
    // The replay still reproduces the decision.
    expect((await post(E, `/decisions/${r.decisionId}/replay`)).json().identical).toBe(true);
  });
});
