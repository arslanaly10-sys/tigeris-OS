import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { closePools, ownerPool } from "../src/db";
import { config } from "../src/config";

let app: FastifyInstance;
const [GSF, ANIA] = DEMO_INSTITUTIONS;

async function directory() {
  const res = await app.inject({ method: "GET", url: "/auth/demo-directory" });
  return res.json().institutions as Array<{ id: string; people: Array<{ id: string; role: string; name: string }> }>;
}

/** Signs in as the person with `role` in `institutionId` and returns the session cookie. */
async function signIn(institutionId: string, role: string): Promise<string> {
  const inst = (await directory()).find((i) => i.id === institutionId)!;
  const person = inst.people.find((p) => p.role === role)!;
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies.find((c) => c.name === "tigeris_session")!;
  const header = `tigeris_session=${cookie.value}`;
  const mfa = await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie: header }, payload: { code: res.json().demoMfaCode } });
  expect(mfa.statusCode).toBe(200);
  return header;
}

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("demo directory", () => {
  it("lists both fictional institutions with seven people each", async () => {
    const dir = await directory();
    expect(dir.map((i) => i.id).sort()).toEqual([GSF.id, ANIA.id].sort());
    for (const i of dir) expect(i.people).toHaveLength(7);
  });
});

describe("sign-in and MFA (FR-01, FR-02, FR-04)", () => {
  it("blocks protected routes until MFA is verified", async () => {
    const inst = (await directory()).find((i) => i.id === GSF.id)!;
    const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: inst.people[0]!.id, method: "sso_simulated" } });
    const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
    const ctx = await app.inject({ method: "GET", url: "/auth/context", headers: { cookie } });
    expect(ctx.statusCode).toBe(401);
    expect(ctx.json().error).toBe("mfa_required");
    const wrong = await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: "000000" } });
    expect(wrong.statusCode).toBe(400);
  });

  it("rejects signing in to one institution as a person from the other", async () => {
    const ania = (await directory()).find((i) => i.id === ANIA.id)!;
    const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId: GSF.id, principalId: ania.people[0]!.id, method: "demo_entry" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns the institution context and permissions after MFA", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const ctx = (await app.inject({ method: "GET", url: "/auth/context", headers: { cookie } })).json();
    expect(ctx.institution.name).toBe("GCC Sovereign Fund A");
    expect(ctx.principal.role).toBe("analyst");
    expect(ctx.permissions).toContain("recommendation.draft");
    expect(ctx.permissions).not.toContain("decision.approve");
    expect(ctx.roleSwitch).toHaveLength(7);
  });
});

describe("permissions are enforced server-side (FR-03, TR-044)", () => {
  it("denies the admin page to an analyst and records the denial", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const res = await app.inject({ method: "GET", url: "/admin/people", headers: { cookie } });
    expect(res.statusCode).toBe(403);
    const auditor = await signIn(GSF.id, "auditor");
    const events = (await app.inject({ method: "GET", url: "/audit/events", headers: { cookie: auditor } })).json().events;
    expect(events.some((e: { action: string }) => e.action === "access.denied")).toBe(true);
  });

  it("lets the administrator see only their own institution's people", async () => {
    const cookie = await signIn(ANIA.id, "administrator");
    const res = (await app.inject({ method: "GET", url: "/admin/people", headers: { cookie } })).json();
    expect(res.people).toHaveLength(7);
    expect(res.people.every((p: { email: string }) => p.email.endsWith("@ania.example"))).toBe(true);
  });
});

describe("institution isolation (FR-42)", () => {
  it("row-level security hides the other institution entirely", async () => {
    const cookie = await signIn(GSF.id, "auditor");
    const res = (await app.inject({ method: "POST", url: "/sovereignty/isolation-check", headers: { cookie } })).json();
    expect(res.ok).toBe(true);
    expect(res.foreignPeopleVisible).toBe(0);
    expect(res.foreignAuditEventsVisible).toBe(0);
    expect(res.ownPeopleVisible).toBe(7);
  });
});

describe("hash-chained audit (FR-40, Q093)", () => {
  it("verifies an intact chain", async () => {
    const cookie = await signIn(GSF.id, "auditor");
    const res = (await app.inject({ method: "POST", url: "/audit/verify", headers: { cookie } })).json();
    expect(res.ok).toBe(true);
    expect(res.checked).toBeGreaterThan(3);
  });

  it("refuses updates from the application", async () => {
    const c = await ownerPool().connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.institution_id', $1, true)", [GSF.id]);
      await expect(c.query("UPDATE audit_events SET action = 'x'")).rejects.toThrow(/append-only/);
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
  });

  it("detects an event that was changed after it was recorded", async () => {
    const owner = ownerPool();
    const c = await owner.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.institution_id', $1, true)", [GSF.id]);
      await c.query("ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update");
      await c.query("UPDATE audit_events SET actor_label = 'Someone else' WHERE institution_id = $1 AND seq = 2", [GSF.id]);
      await c.query("ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update");
      await c.query("COMMIT");
    } finally {
      c.release();
    }
    const cookie = await signIn(GSF.id, "auditor");
    const res = (await app.inject({ method: "POST", url: "/audit/verify", headers: { cookie } })).json();
    expect(res.ok).toBe(false);
    expect(res.firstBrokenSeq).toBe(2);
    await resetDemo();
  });
});

describe("role switching", () => {
  it("moves to a colleague in the same institution and audits it", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const ctx = (await app.inject({ method: "GET", url: "/auth/context", headers: { cookie } })).json();
    const approver = ctx.roleSwitch.find((p: { role: string }) => p.role === "approver");
    const res = await app.inject({ method: "POST", url: "/auth/switch-role", headers: { cookie }, payload: { principalId: approver.id } });
    expect(res.statusCode).toBe(200);
    const newCookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
    const after = (await app.inject({ method: "GET", url: "/auth/context", headers: { cookie: newCookie } })).json();
    expect(after.principal.role).toBe("approver");
    const old = await app.inject({ method: "GET", url: "/auth/context", headers: { cookie } });
    expect(old.statusCode).toBe(401);
  });
});

describe("demo-only shortcuts", () => {
  it("lets only an administrator reset the demo", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const res = await app.inject({ method: "POST", url: "/demo/reset", headers: { cookie }, payload: {} });
    expect(res.statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/auth/context", headers: { cookie } })).json().canReset).toBe(false);
  });

  it("turns off reset and role switching outside demo mode", async () => {
    const admin = await signIn(GSF.id, "administrator");
    const analyst = await signIn(GSF.id, "analyst");
    const approverId = (await app.inject({ method: "GET", url: "/auth/context", headers: { cookie: analyst } })).json().roleSwitch.find((p: { role: string }) => p.role === "approver").id;
    config.demoMode = false;
    try {
      expect((await app.inject({ method: "POST", url: "/demo/reset", headers: { cookie: admin }, payload: {} })).statusCode).toBe(403);
      expect((await app.inject({ method: "POST", url: "/auth/switch-role", headers: { cookie: analyst }, payload: { principalId: approverId } })).statusCode).toBe(403);
      const ctx = (await app.inject({ method: "GET", url: "/auth/context", headers: { cookie: admin } })).json();
      expect([ctx.roleSwitch.length, ctx.canReset]).toEqual([0, false]);
    } finally {
      config.demoMode = true;
    }
  });
});
