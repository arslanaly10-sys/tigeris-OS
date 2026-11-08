import type pg from "pg";
import type { Tx } from "../db";
import { config } from "../config";
import { PRECEDENTS } from "./precedents";

/**
 * Institutional memory (FR-41, FR-42, Q102..Q104). Search combines keyword ranking (PostgreSQL full
 * text) with meaning (local bge-small embeddings in pgvector), fused by reciprocal rank so a precedent
 * found both ways ranks first. Embeddings are computed on this host; no text leaves it.
 */
export const EMBED_MODEL = "bge-small-en-v1.5 (local)";

export async function embed(texts: string[]): Promise<number[][] | null> {
  try {
    const r = await fetch(`${config.reasoningUrl}/embed`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts }), signal: AbortSignal.timeout(30_000) });
    const j = (await r.json()) as { ok: boolean; vectors?: number[][] };
    return j.ok && j.vectors ? j.vectors : null;
  } catch {
    return null;
  }
}
export const vecLiteral = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
export const precedentText = (p: { title: string; summary: string; outcome: string; lessons: string[] }) => `${p.title}. ${p.summary} Outcome: ${p.outcome} Lessons: ${p.lessons.join("; ")}.`;

/** Seeds the precedent library for one institution (runs inside the tenant scope during reset). */
export async function seedPrecedents(c: pg.PoolClient, institutionId: string) {
  const vectors = await embed(PRECEDENTS.map(precedentText));
  for (const [i, p] of PRECEDENTS.entries()) {
    await c.query(
      `INSERT INTO precedents (institution_id, key, title, summary, domain, event_type, region, period, outcome, lessons, tags, claim_class, source_label, status, proposed_by_label, approved_by_label, approved_at, embedding, embedding_model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved','TIGERIS library','TIGERIS library',now(),$14,$15)`,
      [institutionId, p.key, p.title, p.summary, p.domain, p.event_type, p.region, p.period, p.outcome, p.lessons, p.tags, p.claim,
        p.claim === "illustrative" ? "Illustrative summary of a widely reported public event (not a sourced record)" : "Synthetic internal precedent of the demo institution",
        vectors ? vecLiteral(vectors[i]!) : null, vectors ? EMBED_MODEL : null],
    );
  }
  return { count: PRECEDENTS.length, embedded: !!vectors };
}

export interface Hit { id: string; key: string; title: string; summary: string; domain: string; region: string; period: string; outcome: string; lessons: string[]; claim_class: string; source_label: string; case_id: string | null; matchedBy: string[]; keywordRank: number | null; similarity: number | null; score: number }

export async function searchMemory(tx: Tx, q: string, opts: { domain?: string; limit?: number; excludeCaseId?: string } = {}): Promise<{ hits: Hit[]; semantic: boolean }> {
  const limit = opts.limit ?? 10;
  const filters = "$1::text IS NOT NULL AND status = 'approved' AND ($2::text IS NULL OR domain = $2) AND ($3::uuid IS NULL OR case_id IS DISTINCT FROM $3)";
  const kw = (await tx.query(
    `SELECT id, ts_rank_cd(search, websearch_to_tsquery('english', $1)) AS rank FROM precedents
      WHERE ${filters} AND search @@ websearch_to_tsquery('english', $1) ORDER BY rank DESC LIMIT 25`, [q, opts.domain ?? null, opts.excludeCaseId ?? null])).rows as Array<{ id: string; rank: number }>;
  // Keyword search also tries OR-ed words so short natural questions still match.
  const words = q.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
  const orKw = words.length > 1 && kw.length < 5 ? (await tx.query(
    `SELECT id, ts_rank_cd(search, to_tsquery('english', $4)) AS rank FROM precedents WHERE ${filters} AND search @@ to_tsquery('english', $4) ORDER BY rank DESC LIMIT 25`,
    [q, opts.domain ?? null, opts.excludeCaseId ?? null, words.map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean).join(" | ")])).rows as Array<{ id: string; rank: number }> : [];
  const kwAll = [...kw, ...orKw.filter((r) => !kw.some((k) => k.id === r.id))];
  const v = await embed([q]);
  const sem = v ? (await tx.query(
    `SELECT id, 1 - (embedding <=> $4::vector) AS sim FROM precedents WHERE ${filters} AND embedding IS NOT NULL ORDER BY embedding <=> $4::vector LIMIT 25`,
    [q, opts.domain ?? null, opts.excludeCaseId ?? null, vecLiteral(v[0]!)])).rows as Array<{ id: string; sim: number }> : [];
  const semKept = sem.filter((s) => s.sim >= 0.55); // below this, matches are mostly noise for bge-small
  const score = new Map<string, number>();
  kwAll.forEach((r, i) => score.set(r.id, (score.get(r.id) ?? 0) + 1 / (60 + i)));
  semKept.forEach((r, i) => score.set(r.id, (score.get(r.id) ?? 0) + 1 / (60 + i)));
  const ids = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (!ids.length) return { hits: [], semantic: !!v };
  const rows = (await tx.query("SELECT id, key, title, summary, domain, region, period, outcome, lessons, claim_class, source_label, case_id FROM precedents WHERE id = ANY($1)", [ids])).rows;
  const hits = ids.map((id) => {
    const r = rows.find((x) => x.id === id)!;
    const k = kwAll.findIndex((x) => x.id === id);
    const s = semKept.find((x) => x.id === id);
    return { ...r, matchedBy: [...(k >= 0 ? ["keyword"] : []), ...(s ? ["meaning"] : [])], keywordRank: k >= 0 ? k + 1 : null, similarity: s ? Math.round(s.sim * 1000) / 1000 : null, score: Math.round(score.get(id)! * 10000) / 10000 } as Hit;
  });
  return { hits, semantic: !!v };
}

/** Draft memory entry from a decided case, assembled from its own records (no model). */
export async function draftEntry(tx: Tx, caseId: string) {
  const c = (await tx.query("SELECT case_key, title, objective, domain, state, closure FROM cases WHERE id = $1", [caseId])).rows[0];
  const d = (await tx.query("SELECT id, option_title, outcome, status, rationale, proposed_by_label, created_at FROM decisions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1", [caseId])).rows[0];
  const h = (await tx.query("SELECT h.title, h.status, (SELECT note FROM handoff_updates u WHERE u.handoff_id = h.id ORDER BY created_at DESC LIMIT 1) AS note FROM handoffs h WHERE h.case_id = $1", [caseId])).rows;
  const ch = (await tx.query("SELECT s.output->'challenges' AS c FROM agent_steps s JOIN agent_runs r ON r.id = s.run_id WHERE r.case_id = $1 AND s.phase = 'challenge' ORDER BY r.started_at DESC LIMIT 1", [caseId])).rows[0]?.c ?? [];
  return {
    title: `${c.title} (${new Date().getFullYear()})`,
    summary: `${c.objective}${d ? ` Decision: ${d.outcome} "${d.option_title}" (${d.status}). Rationale: ${d.rationale}` : " No decision recorded yet."}`,
    outcome: h.length ? h.map((x: { title: string; status: string; note: string | null }) => `${x.title}: ${x.status.replace("_", " ")}${x.note ? ` (${x.note})` : ""}`).join("; ") : c.closure ? `Closed as ${c.closure.replace("_", " ")}` : "In progress",
    lessons: (ch as Array<{ contention: string; response: string }>).slice(0, 3).map((x) => `${x.contention} ${x.response.split(".")[0]}.`),
    domain: c.domain, caseKey: c.case_key, decisionId: d?.id ?? null,
  };
}
