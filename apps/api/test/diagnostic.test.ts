import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { GAPS } from "@tigeris/shared";
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
const actions = (inst: string) => withTenant(inst, (tx) => tx.query("SELECT action, details FROM audit_events ORDER BY seq")).then((r) => r.rows as Array<{ action: string; details: Record<string, unknown> }>);
const answers = (score: number) => GAPS.flatMap((g) => g.questions.map((q) => ({ questionId: q.id, score, evidence: "interview" })));

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("sovereign gap diagnostic (commercial model, steps 1 to 3)", () => {
  it("serves the method with its seven gaps and the assumptions behind the value range", async () => {
    const m = (await app.inject({ method: "GET", url: "/diagnostic/model", headers: { cookie: await signIn("auditor") } })).json();
    expect(m.gaps).toHaveLength(7);
    expect(m.assumptions.map((a: { key: string }) => a.key)).toEqual(["max_bp", "low_share", "bp"]);
  });

  it("opens on a synthetic sample assessment, labelled as such", async () => {
    const list = (await app.inject({ method: "GET", url: "/diagnostic/assessments", headers: { cookie: await signIn("analyst") } })).json().assessments;
    expect(list).toHaveLength(1);
    expect(list[0].data_mode).toBe("synthetic");
    expect(list[0].result.complete).toBe(true);
    expect(list[0].result.valueAtStake.highUsd).toBeGreaterThan(0);
  });

  it("scores on the server, ignores any result the client sends, and audits the assessment", async () => {
    const cookie = await signIn("executive");
    const res = await app.inject({ method: "POST", url: "/diagnostic/assessments", headers: { cookie },
      payload: { title: "Board readiness check", subjectLabel: "Whole institution", aumUsd: 1e12, answers: answers(0), result: { readinessPct: 100 } } });
    expect(res.statusCode).toBe(200);
    const a = res.json();
    expect(a.result.readinessPct).toBe(0);
    const maxBp = GAPS.reduce((s, g) => s + g.maxBp, 0);
    expect(a.result.valueAtStake.highUsd).toBe(Math.round(1e12 * maxBp * 1e-4)); // 1 bp of $1 tn = $100 m
    expect(a.result.evidence).toBe("interview");
    expect(a.input_hash).toMatch(/^[0-9a-f]{64}$/);
    const ev = (await actions(GSF.id)).filter((e) => e.action === "diagnostic.assessed").at(-1)!;
    expect(ev.details.readinessPct).toBe(0);
  });

  it("rejects bad answers and refuses roles without the permission", async () => {
    const analyst = await signIn("analyst");
    const bad = await app.inject({ method: "POST", url: "/diagnostic/assessments", headers: { cookie: analyst }, payload: { title: "Bad", subjectLabel: "X", answers: [{ questionId: "nope", score: 2, evidence: "measured" }] } });
    expect(bad.statusCode).toBe(400);
    const auditor = await app.inject({ method: "POST", url: "/diagnostic/assessments", headers: { cookie: await signIn("auditor") }, payload: { title: "Try", subjectLabel: "X", answers: answers(2) } });
    expect(auditor.statusCode).toBe(403);
  });

  it("exports the report as Markdown, audits the export, and keeps each institution's assessments its own", async () => {
    const analyst = await signIn("analyst");
    const id = (await app.inject({ method: "GET", url: "/diagnostic/assessments", headers: { cookie: analyst } })).json().assessments[0].id;
    const rep = await app.inject({ method: "GET", url: `/diagnostic/assessments/${id}/report`, headers: { cookie: analyst } });
    expect(rep.statusCode).toBe(200);
    expect(rep.headers["content-type"]).toContain("text/markdown");
    expect(rep.body).toContain("decides nothing");
    expect((await actions(GSF.id)).some((e) => e.action === "diagnostic.report_exported")).toBe(true);
    const other = await app.inject({ method: "GET", url: `/diagnostic/assessments/${id}`, headers: { cookie: await signIn("analyst", ANIA) } });
    expect(other.statusCode).toBe(404);
  });
});
