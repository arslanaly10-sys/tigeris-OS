import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { FUND_A_INPUTS, KPI_DEFS, METRIC_BY_ID, RUBRIC, RUBRIC_VERSION, VALUATION_DEFAULTS, diagnose, valuation, type Diagnosis } from "@tigeris/shared";
import type { Actor } from "./decisions";

/**
 * Engagements (brief v3 §7.1): intake → diagnosis → value at stake. Scores and values are computed by the shared
 * deterministic engine from the stored inputs and assumptions, never stored as results and never produced by a model.
 * Workshop edits are written to the Ledger (audit chain) in the same transaction.
 */
export interface Intake {
  fullName: string; title: string; email: string; phone?: string; organisation: string; website?: string;
  category: string; jurisdiction: string; interests: string[]; posture: string; challenge: string; window: string; format: string; aumUsd?: number | null;
}

export async function createEngagement(tx: Tx, inst: string, actor: Actor, intake: Intake, opts: { title?: string; dataMode?: "institution" | "synthetic"; inputs?: Record<string, number | null>; status?: string } = {}) {
  const e = (await tx.query("INSERT INTO engagements (institution_id, title, intake, status, data_mode, rubric_version, created_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [inst, opts.title ?? `${intake.organisation}: ${intake.challenge.slice(0, 60)}`, JSON.stringify(intake), opts.status ?? "briefing", opts.dataMode ?? "institution", RUBRIC_VERSION, actor.label])).rows[0]!;
  const label = opts.dataMode === "synthetic" ? "synthetic" : "client";
  for (const g of RUBRIC) for (const m of g.metrics) {
    const v = opts.inputs?.[m.id] ?? null;
    await tx.query("INSERT INTO engagement_inputs (institution_id, engagement_id, metric_id, value, source, label, updated_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [inst, e.id, m.id, v, v === null ? "Not yet provided" : opts.dataMode === "synthetic" ? "Synthetic baseline for the demonstration" : "Intake", label, actor.label]);
  }
  for (const a of VALUATION_DEFAULTS) {
    const value = a.key === "aum_usd" && intake.aumUsd ? intake.aumUsd : a.value;
    await tx.query("INSERT INTO engagement_assumptions (institution_id, engagement_id, key, value, source, benchmark_status, updated_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [inst, e.id, a.key, value, a.key === "aum_usd" && intake.aumUsd ? "Stated in the intake (approximate)" : a.source, a.benchmarkStatus, actor.label]);
  }
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "engagement.created", resourceType: "engagement", resourceId: e.id,
    details: { organisation: intake.organisation, category: intake.category, jurisdiction: intake.jurisdiction, dataMode: opts.dataMode ?? "institution", rubricVersion: RUBRIC_VERSION } });
  return e.id as string;
}

export async function loadEngagement(tx: Tx, id: string) {
  const e = (await tx.query("SELECT * FROM engagements WHERE id = $1", [id])).rows[0];
  if (!e) return null;
  const inputs = (await tx.query("SELECT metric_id, value, source, label, updated_by_label, updated_at FROM engagement_inputs WHERE engagement_id = $1", [id])).rows;
  const assumptions = (await tx.query("SELECT key, value, source, benchmark_status, updated_by_label, updated_at FROM engagement_assumptions WHERE engagement_id = $1", [id])).rows;
  const values = Object.fromEntries(inputs.map((r) => [r.metric_id, r.value === null ? null : Number(r.value)]));
  const a = (k: string) => Number(assumptions.find((x) => x.key === k)?.value);
  const diagnosis: Diagnosis = diagnose(values);
  const value = valuation({ aumUsd: a("aum_usd"), structuralInefficiency: a("structural_inefficiency"), improvement: { low: a("improvement_low"), base: a("improvement_base"), high: a("improvement_high") }, years: a("years") }, diagnosis);
  const kpis = KPI_DEFS.map((k) => ({ ...k, current: values[k.key] ?? null }));
  return { engagement: e, inputs, assumptions, diagnosis, value, kpis };
}

export async function editInput(tx: Tx, inst: string, actor: Actor, id: string, metricId: string, value: number | null, note: string) {
  if (!METRIC_BY_ID[metricId]) return { status: 404 as const, message: "No such metric in the rubric." };
  const before = (await tx.query("SELECT value FROM engagement_inputs WHERE engagement_id = $1 AND metric_id = $2 FOR UPDATE", [id, metricId])).rows[0];
  if (!before) return { status: 404 as const, message: "No such engagement." };
  const was = before.value === null ? null : Number(before.value);
  const d0 = (await loadEngagement(tx, id))!.diagnosis;
  await tx.query("UPDATE engagement_inputs SET value = $3, source = $4, label = 'workshop', updated_by_label = $5, updated_at = now() WHERE engagement_id = $1 AND metric_id = $2", [id, metricId, value, note || "Workshop edit", actor.label]);
  const d1 = (await loadEngagement(tx, id))!.diagnosis;
  const gap = METRIC_BY_ID[metricId]!.gapId;
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "diagnosis.input_edited", resourceType: "engagement", resourceId: id,
    details: { metricId, from: was, to: value, note, gap, gapScore: { from: d0.gaps[gap - 1]!.score, to: d1.gaps[gap - 1]!.score }, csai: { from: d0.indices.csai, to: d1.indices.csai } } });
  return { status: 200 as const, diagnosis: d1 };
}

export async function editAssumption(tx: Tx, inst: string, actor: Actor, id: string, key: string, value: number) {
  const def = VALUATION_DEFAULTS.find((a) => a.key === key);
  if (!def) return { status: 404 as const, message: "No such assumption." };
  if ((def.min !== undefined && value < def.min) || (def.max !== undefined && value > def.max)) return { status: 400 as const, message: `${def.label} must be between ${def.min} and ${def.max}.` };
  const before = (await tx.query("SELECT value FROM engagement_assumptions WHERE engagement_id = $1 AND key = $2 FOR UPDATE", [id, key])).rows[0];
  if (!before) return { status: 404 as const, message: "No such engagement." };
  await tx.query("UPDATE engagement_assumptions SET value = $3, updated_by_label = $4, updated_at = now() WHERE engagement_id = $1 AND key = $2", [id, key, value, actor.label]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "valuation.assumption_edited", resourceType: "engagement", resourceId: id, details: { key, from: Number(before.value), to: value } });
  return { status: 200 as const };
}

/** The golden-path engagement: GCC Sovereign Fund A, $100B illustrative mandate, synthetic baseline. */
export async function seedFundA(tx: Tx, inst: string, analyst: Actor) {
  return createEngagement(tx, inst, analyst, {
    fullName: "Noura Al-Harbi (fictional)", title: "Chief Risk Officer, Energy", email: "noura.alharbi@example.invalid", organisation: "GCC Sovereign Fund A",
    category: "Sovereign Wealth Fund", jurisdiction: "Kingdom of Saudi Arabia",
    interests: ["Sovereign Capital Intelligence and Allocation", "Trade, Energy and Critical Supply Resilience", "Institutional Governance, Memory and Continuity"],
    posture: "Early Government Deployment Pilot", challenge: "How do we turn the Hormuz disruption into sovereign capability within five months?",
    window: "60 days", format: "Secure Virtual Council", aumUsd: 100e9,
  }, { title: "GCC Sovereign Fund A · Hormuz golden path", dataMode: "synthetic", inputs: FUND_A_INPUTS, status: "report" });
}
