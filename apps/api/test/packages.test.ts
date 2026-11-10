import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools } from "../src/db";

// Governed decision loop (brief v3 §6, §11.1 steps 6–7).
const [GSF] = DEMO_INSTITUTIONS;
const Q = "How do we turn the Hormuz disruption into sovereign capability within 5 months?";
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

beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("governor question → brief → package → approval → owners → Ledger", () => {
  it("runs the golden path and drops coordination debt by a measured amount", async () => {
    const A = await signIn(GSF.id, "analyst"), G = await signIn(GSF.id, "approver"), E = await signIn(GSF.id, "executive");
    const eid = (await get(A, "/engagements")).engagements[0].id;
    const brief = (await post(A, `/engagements/${eid}/brief`, { question: Q })).json();
    expect(brief.brief.meta.model).toBe("cache");
    expect(brief.brief.effects.third.length).toBeGreaterThan(0);
    const before = (await get(A, `/engagements/${eid}`)).diagnosis.indices.coordinationDebt;
    const pkg = (await post(A, `/engagements/${eid}/packages`, { question: Q })).json();
    // The executive is not the authority for this package; the Governance Officer (approver) is.
    expect((await post(E, `/packages/${pkg.packageId}/decision`, { decision: "approve" })).statusCode).toBe(403);
    expect((await post(G, `/packages/${pkg.packageId}/decision`, { decision: "reject", comment: "" })).statusCode).toBe(400);
    const r = (await post(G, `/packages/${pkg.packageId}/decision`, { decision: "approve", comment: "Inside the standing envelope." })).json();
    expect(r).toMatchObject({ packageStatus: "approved", owners: 4 });
    expect(r.coordination.to).toBeLessThan(before);
    expect(r.coordination.to).toBeLessThan(50); // the boardroom flips to "resolved"
    expect((await post(G, `/packages/${pkg.packageId}/decision`, { decision: "approve" })).statusCode).toBe(409);
    const list = (await get(A, `/engagements/${eid}/packages`)).packages;
    expect(list[0].tasks).toHaveLength(4);
    const e = await get(A, `/engagements/${eid}`);
    expect(e.inputs.find((i: { metric_id: string }) => i.metric_id === "signal_to_owner_days").label).toBe("measured");
    const lr = await get(A, `/engagements/${eid}/ledger`);
    const ledger = lr.entries.map((x: { action: string }) => x.action);
    expect(ledger).toEqual(expect.arrayContaining(["engagement.created", "brief.generated", "package.created", "package.refused", "package.approved"]));
  });
});
