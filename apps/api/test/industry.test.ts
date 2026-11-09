import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { INDUSTRY_KEYS } from "@tigeris/shared";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools } from "../src/db";

const [GSF] = DEMO_INSTITUTIONS;
let app: FastifyInstance;

async function signIn(role: string, industry?: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === GSF.id).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: person.id, method: "demo_entry", ...(industry ? { industry } : {}) } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}
const get = async (c: string, url: string) => (await app.inject({ method: "GET", url, headers: { cookie: c } })).json();

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("industry lens (sign-in, 9 Nov 2026)", () => {
  it("keeps the industry chosen at sign-in and gives the person their industry job title", async () => {
    const c = await signIn("domain_expert", "energy");
    const ctx = await get(c, "/auth/context");
    expect(ctx.principal.industry).toBe("energy");
    expect(ctx.principal.industryTitle).toBe("Head of Crude Trading");
    expect(ctx.principal.industryTitleAr).toMatch(/[؀-ۿ]/);
    expect(ctx.permissions).toEqual((await get(await signIn("domain_expert", "healthcare"), "/auth/context")).permissions);
  });

  it("defaults to sovereign capital and refuses an unknown industry", async () => {
    expect((await get(await signIn("analyst"), "/auth/context")).principal.industry).toBe("sovereign_capital");
    const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
    const person = dir.find((i: { id: string }) => i.id === GSF.id).people[0];
    const bad = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: person.id, method: "demo_entry", industry: "crypto" } });
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("orders cases, signals and the attention queue with the industry first", async () => {
    const c = await signIn("analyst", "healthcare");
    const cases = (await get(c, "/cases")).cases;
    expect(cases[0].domain).toBe("healthcare");
    expect(cases[0].in_industry).toBe(true);
    expect(cases.filter((x: { in_industry: boolean }) => x.in_industry).every((x: { domain: string }) => x.domain === "healthcare")).toBe(true);
    const signals = (await get(c, "/signals")).signals;
    expect(signals[0].in_industry).toBe(true);
    const att = await get(c, "/attention");
    expect(att.industry).toBe("healthcare");
    expect(att.items.some((i: { inIndustry?: boolean }) => i.inIndustry)).toBe(true);
  });

  it("switches the lens with an audit event and keeps it across a role switch", async () => {
    const c = await signIn("analyst", "energy");
    const bad = await app.inject({ method: "POST", url: "/auth/industry", headers: { cookie: c }, payload: { industry: "crypto" } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: "POST", url: "/auth/industry", headers: { cookie: c }, payload: { industry: "telecoms" } });
    expect(ok.json().status).toBe("changed");
    expect((await get(c, "/auth/context")).principal.industry).toBe("telecoms");
    const auditor = await signIn("auditor");
    const events = await get(auditor, "/audit/events?limit=50");
    expect(JSON.stringify(events)).toContain("session.industry_changed");
    const ctx = await get(c, "/auth/context");
    const colleague = ctx.roleSwitch.find((x: { role: string }) => x.role === "approver");
    const sw = await app.inject({ method: "POST", url: "/auth/switch-role", headers: { cookie: c }, payload: { principalId: colleague.id } });
    const c2 = `tigeris_session=${sw.cookies.find((k) => k.name === "tigeris_session")!.value}`;
    expect((await get(c2, "/auth/context")).principal.industry).toBe("telecoms");
  });

  it("gives every one of the 12 industries a domain pack with cases and graph entities", async () => {
    const d = (await get(await signIn("analyst"), "/domains")).domains as Array<{ key: string; cases: number; entities: number }>;
    for (const k of INDUSTRY_KEYS) {
      expect(d.find((x) => x.key === k)?.cases, `${k} cases`).toBeGreaterThan(0);
      expect(d.find((x) => x.key === k)?.entities, `${k} entities`).toBeGreaterThan(0);
    }
  });
});
