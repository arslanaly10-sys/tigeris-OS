import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, withTenant } from "../src/db";

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
beforeAll(async () => { await resetDemo(); app = await buildApp(); });
afterAll(async () => { await app.close(); await closePools(); });

describe("playbooks (tigerisos.ai scenarios)", () => {
  it("opens a real case from a playbook, at 'detected', with its template, and audits it", async () => {
    const cookie = await signIn("analyst");
    const res = await app.inject({ method: "POST", url: "/playbooks/mandate-drift/case", headers: { cookie }, payload: {} });
    expect(res.statusCode).toBe(200);
    const key = res.json().caseKey;
    const c = (await app.inject({ method: "GET", url: `/cases/${key}`, headers: { cookie } })).json();
    expect(c.case.title).toBe("Mandate alignment");
    expect(c.case.state).toBe("detected");
    const row = await withTenant(GSF.id, (tx) => tx.query("SELECT scenario_template FROM cases WHERE case_key = $1", [key]));
    expect(row.rows[0].scenario_template).toBe("oil45");
    const audit = await withTenant(GSF.id, (tx) => tx.query("SELECT details FROM audit_events WHERE action = 'case.created' ORDER BY seq DESC LIMIT 1"));
    expect(audit.rows[0].details.fromPlaybook).toBe("mandate-drift");
  });
  it("refuses roles that cannot open cases and unknown playbooks", async () => {
    expect((await app.inject({ method: "POST", url: "/playbooks/mandate-drift/case", headers: { cookie: await signIn("auditor") }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/playbooks/nope/case", headers: { cookie: await signIn("analyst") }, payload: {} })).statusCode).toBe(404);
  });
});
