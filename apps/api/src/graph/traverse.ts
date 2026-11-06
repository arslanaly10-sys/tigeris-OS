import type { Tx } from "../db";

/**
 * How a disruption travels along each relationship (TR-021, TR-037).
 *  forward  — trouble at the subject reaches the object (A leads_to B)
 *  reverse  — trouble at the object reaches the subject (A depends_on B)
 *  alternative — the subject is an alternative to the object, shown but not propagated
 *  none     — structural only (located_in, held_by)
 */
export const IMPACT_DIRECTION: Record<string, "forward" | "reverse" | "alternative" | "none"> = {
  leads_to: "forward", feeds: "forward", delivers_to: "forward", produces: "forward",
  transits: "reverse", depends_on: "reverse", exposed_to: "reverse", ships_via: "reverse", imports_food_via: "reverse",
  uses_route: "reverse", handles: "reverse", imports_via: "reverse", imports: "reverse", governed_by: "none",
  bypasses: "alternative", alternative_to: "alternative", located_in: "none", held_by: "none", designated_under: "none",
};

export interface Hop {
  depth: number;
  entity: { id: string; key: string; name: string; type: string; claim_class: string };
  via: { relationshipId: string; predicate: string; label: string; direction: "forward" | "reverse"; class: string; weight: number | null; evidenceCount: number; fromKey: string };
  cumulativeWeight: number;
  path: string[];
}

interface Edge { id: string; subject_id: string; object_id: string; predicate: string; predicate_label: string; relationship_class: string; impact_weight: number | null; evidence_count: number }

/**
 * Breadth-first impact paths from one entity, bounded by depth and node count, with cycle protection.
 * Each entity appears once, reached by its strongest path. Alternatives (bypass routes) are listed separately.
 */
export async function impactPaths(tx: Tx, fromKey: string, opts: { maxDepth?: number; maxNodes?: number; classes?: string[] } = {}) {
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 3, 1), 5);
  const maxNodes = Math.min(opts.maxNodes ?? 150, 400);
  const start = (await tx.query("SELECT id, key, name, type, claim_class FROM entities WHERE key = $1 OR id::text = $1", [fromKey])).rows[0];
  if (!start) return undefined;
  const edges: Edge[] = (await tx.query(
    `SELECT r.id, r.subject_id, r.object_id, r.predicate, r.predicate_label, r.relationship_class, r.impact_weight,
            (SELECT count(*)::int FROM relationship_evidence re WHERE re.relationship_id = r.id) AS evidence_count
       FROM entity_relationships r WHERE r.status = 'active' AND ($1::text[] IS NULL OR r.relationship_class = ANY($1))`, [opts.classes ?? null])).rows;
  const out = new Map<string, Array<{ to: string; e: Edge; dir: "forward" | "reverse" }>>();
  const alternatives: Edge[] = [];
  for (const e of edges) {
    const d = IMPACT_DIRECTION[e.predicate] ?? "none";
    if (d === "forward") (out.get(e.subject_id) ?? out.set(e.subject_id, []).get(e.subject_id)!).push({ to: e.object_id, e, dir: "forward" });
    else if (d === "reverse") (out.get(e.object_id) ?? out.set(e.object_id, []).get(e.object_id)!).push({ to: e.subject_id, e, dir: "reverse" });
    else if (d === "alternative" && e.object_id === start.id) alternatives.push(e);
  }
  const ids = new Set<string>([start.id]);
  const best = new Map<string, { depth: number; weight: number; via: Hop["via"]; path: string[]; fromId: string }>();
  let frontier = [{ id: start.id, weight: 1, path: [start.key as string], key: start.key as string }];
  for (let depth = 1; depth <= maxDepth && frontier.length && best.size < maxNodes; depth++) {
    const next: typeof frontier = [];
    for (const n of frontier) {
      for (const { to, e, dir } of out.get(n.id) ?? []) {
        if (n.path.length > 1 && to === start.id) continue; // cycle back to the origin
        const w = n.weight * (e.impact_weight ?? 0.5);
        const prev = best.get(to);
        if (to === start.id || (prev && (prev.depth < depth || prev.weight >= w))) continue;
        best.set(to, { depth, weight: w, fromId: n.id, path: [...n.path], via: { relationshipId: e.id, predicate: e.predicate, label: e.predicate_label, direction: dir, class: e.relationship_class, weight: e.impact_weight, evidenceCount: e.evidence_count, fromKey: n.key } });
        ids.add(to);
        if (best.size >= maxNodes) break;
      }
    }
    for (const [id, b] of best) if (b.depth === depth) next.push({ id, weight: b.weight, path: [], key: "" });
    // resolve keys for the next frontier
    if (next.length) {
      const rows = (await tx.query("SELECT id, key FROM entities WHERE id = ANY($1)", [next.map((x) => x.id)])).rows;
      const k = new Map(rows.map((r) => [r.id, r.key]));
      for (const x of next) { x.key = k.get(x.id); x.path = [...best.get(x.id)!.path, x.key]; best.get(x.id)!.path = x.path; }
    }
    frontier = next;
  }
  const altIds = alternatives.map((a) => a.subject_id);
  const ents = new Map((await tx.query("SELECT id, key, name, type, claim_class FROM entities WHERE id = ANY($1)", [[...ids, ...altIds]])).rows.map((r) => [r.id, r]));
  const hops: Hop[] = [...best.entries()].map(([id, b]) => ({ depth: b.depth, entity: ents.get(id), via: b.via, cumulativeWeight: Math.round(b.weight * 1000) / 1000, path: b.path }))
    .sort((a, b) => a.depth - b.depth || b.cumulativeWeight - a.cumulativeWeight);
  return {
    origin: start,
    maxDepth,
    truncated: best.size >= maxNodes,
    hops,
    alternatives: alternatives.map((a) => ({ entity: ents.get(a.subject_id), label: a.predicate_label, class: a.relationship_class, relationshipId: a.id, evidenceCount: a.evidence_count })),
  };
}
