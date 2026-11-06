import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { canonicalJson, type TransferPackage } from "@tigeris/shared";
import { buildApp } from "../src/server";
import { resetDemo, DEMO_INSTITUTIONS } from "../src/scripts/seed-data";
import { drainQueue } from "../src/evidence/jobs";
import { latestBundledPackage } from "../src/routes/evidence";
import { closePools } from "../src/db";

const DATA = path.resolve(import.meta.dirname, "../../../data");
const [GSF, ANIA] = DEMO_INSTITUTIONS;
let app: FastifyInstance;
let bundled: Buffer;

async function signIn(institutionId: string, role: string): Promise<string> {
  const dir = (await app.inject({ method: "GET", url: "/auth/demo-directory" })).json().institutions;
  const person = dir.find((i: { id: string }) => i.id === institutionId).people.find((p: { role: string }) => p.role === role);
  const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload: { institutionId, principalId: person.id, method: "demo_entry" } });
  const cookie = `tigeris_session=${res.cookies.find((c) => c.name === "tigeris_session")!.value}`;
  await app.inject({ method: "POST", url: "/auth/mfa", headers: { cookie }, payload: { code: res.json().demoMfaCode } });
  return cookie;
}

async function upload(cookie: string, url: string, bytes: Buffer, name: string, type = "application/octet-stream") {
  const res = await app.inject({ method: "POST", url, headers: { cookie, "content-type": type, "x-file-name": name }, payload: bytes });
  await drainQueue();
  const job = res.json();
  return { res, job: job.id ? (await app.inject({ method: "GET", url: `/jobs/${job.id}`, headers: { cookie } })).json() : undefined };
}

const repack = (mutate: (p: TransferPackage) => void, resign?: Parameters<typeof sign>[2]) => {
  const pkg: TransferPackage = JSON.parse(gunzipSync(bundled).toString("utf8"));
  mutate(pkg);
  if (resign) pkg.signature.value = sign(null, Buffer.from(canonicalJson(pkg.manifest)), resign).toString("base64");
  return gzipSync(Buffer.from(JSON.stringify(pkg)));
};

beforeAll(async () => {
  await resetDemo();
  app = await buildApp();
  bundled = readFileSync(path.join(DATA, "packages", (await latestBundledPackage())!));
});
afterAll(async () => {
  await app.close();
  await closePools();
});

describe("bundled public snapshot import", () => {
  it("imports every file with facts and source lineage", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const jobs = (await app.inject({ method: "GET", url: "/jobs", headers: { cookie } })).json().jobs;
    const snapshot = jobs.find((j: { label: string }) => j.label.startsWith("public-snapshot"));
    expect(snapshot.status).toBe("succeeded");
    expect(snapshot.result.files.length).toBeGreaterThanOrEqual(15);
    const ind = (await app.inject({ method: "GET", url: "/indicators", headers: { cookie } })).json();
    const gdp = ind.columns.find((c: { key: string }) => c.key === "gdp").rows.find((r: { subject: string }) => r.subject === "SAU");
    expect(gdp.value_num).toBeGreaterThan(5e11);
    const lineage = (await app.inject({ method: "GET", url: `/facts/${gdp.id}/lineage`, headers: { cookie } })).json();
    expect(lineage.source.key).toBe("worldbank.wdi");
    expect(lineage.evidence.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(lineage.evidence.signer).toContain("collector");
    expect(lineage.validations[0].checks.some((c: { rule: string; result: string }) => c.rule === "integrity.hash" && c.result === "pass")).toBe(true);
  });

  it("extracts the EIA Hormuz figures with the source sentence", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const ind = (await app.inject({ method: "GET", url: "/indicators", headers: { cookie } })).json();
    const flow = ind.hormuz.find((h: { predicate_label: string }) => h.predicate_label === "Oil flow through the strait");
    expect(flow.value_num).toBe(20);
    expect(flow.excerpt).toMatch(/20 million barrels per day/);
  });

  it("returns the same job for a repeated import instead of duplicating data (TR-003)", async () => {
    const cookie = await signIn(GSF.id, "administrator");
    const res = await app.inject({ method: "POST", url: "/sources/packages/bundled", headers: { cookie } });
    expect(res.json().duplicate).toBe(true);
  });
});

describe("air-gap package verification (TR-017, Q092)", () => {
  it("rejects a package whose manifest was changed after signing", async () => {
    const cookie = await signIn(GSF.id, "administrator");
    const { job } = await upload(cookie, "/sources/packages", repack((p) => { p.manifest.files[0]!.title = "Altered"; }), "altered.tigpkg");
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/changed after it was signed/);
  });

  it("rejects a package signed by a key the institution does not trust", async () => {
    const cookie = await signIn(GSF.id, "administrator");
    const { privateKey } = generateKeyPairSync("ed25519");
    const { job } = await upload(cookie, "/sources/packages", repack((p) => { p.signature.keyFingerprint = "f".repeat(32); }, privateKey), "untrusted.tigpkg");
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/does not trust/);
  });

  it("rejects a file whose content no longer matches its signed hash", async () => {
    const cookie = await signIn(ANIA.id, "administrator");
    const { job } = await upload(cookie, "/sources/packages", repack((p) => {
      const name = p.manifest.files[0]!.name;
      p.files[name] = Buffer.from("tampered").toString("base64");
    }), "swapped-file.tigpkg");
    expect(job.status).toBe("succeeded");
    expect(job.result.files[0].outcome).toBe("rejected");
    expect(job.result.files[0].reasons.join(" ")).toMatch(/signed hash/);
  });

  it("only administrators can import packages", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const res = await app.inject({ method: "POST", url: "/sources/packages/bundled", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("document upload and the injection screen (FR-11, Q051, Q099)", () => {
  it("accepts the synthetic advisory and extracts candidate figures for review", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const { job } = await upload(cookie, "/evidence/demo-documents/gulf-shipping-advisory-synthetic.pdf", Buffer.alloc(0), "x");
    expect(job.result.files[0].outcome).toBe("accepted");
    const review = (await app.inject({ method: "GET", url: "/facts/review", headers: { cookie } })).json().facts;
    const premium = review.find((f: { value_text: string }) => /0\.7%/.test(f.value_text));
    expect(premium.claim_class).toBe("synthetic");
    expect(premium.locator).toBe("page 1");
    const r = await app.inject({ method: "POST", url: `/facts/${premium.id}/review`, headers: { cookie }, payload: { decision: "accepted" } });
    expect(r.json().status).toBe("accepted");
  });

  it("quarantines a document with hidden instructions and stores no facts from it", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const { job } = await upload(cookie, "/evidence/demo-documents/port-congestion-note-poisoned.pdf", Buffer.alloc(0), "x");
    const f = job.result.files[0];
    expect(f.outcome).toBe("quarantined");
    expect(f.facts).toBe(0);
    expect(f.reasons.join(" ")).toMatch(/ignore previous instructions/);
    expect(f.reasons.join(" ")).toMatch(/below a legible size/);
    const q = (await app.inject({ method: "GET", url: "/evidence?state=quarantined", headers: { cookie } })).json().evidence;
    expect(q.some((e: { title: string }) => /poisoned/.test(e.title))).toBe(true);
  });

  it("rejects a file that is not a PDF", async () => {
    const cookie = await signIn(GSF.id, "analyst");
    const { job } = await upload(cookie, "/evidence/documents", Buffer.from("not a pdf at all"), "fake.pdf", "application/pdf");
    expect(job.result.files[0].outcome).toBe("rejected");
  });

  it("auditors cannot upload", async () => {
    const cookie = await signIn(GSF.id, "auditor");
    const res = await app.inject({ method: "POST", url: "/evidence/demo-documents/gulf-shipping-advisory-synthetic.pdf", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("evidence isolation (FR-42)", () => {
  it("one institution cannot read the other's evidence or lineage", async () => {
    const gsf = await signIn(GSF.id, "analyst");
    const ania = await signIn(ANIA.id, "analyst");
    const gsfEvidence = (await app.inject({ method: "GET", url: "/evidence", headers: { cookie: gsf } })).json().evidence[0];
    const res = await app.inject({ method: "GET", url: `/evidence/${gsfEvidence.id}`, headers: { cookie: ania } });
    expect(res.statusCode).toBe(404);
    const gsfFact = (await app.inject({ method: "GET", url: "/indicators", headers: { cookie: gsf } })).json().columns[0].rows[0];
    const lineage = await app.inject({ method: "GET", url: `/facts/${gsfFact.id}/lineage`, headers: { cookie: ania } });
    expect(lineage.statusCode).toBe(404);
  });
});
