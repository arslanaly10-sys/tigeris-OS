import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { requirePermission } from "../session";
import { impactPaths } from "../graph/traverse";
import { aircraftKind, shipType } from "@tigeris/shared";

export async function graphRoutes(app: FastifyInstance) {
  app.get("/graph/stats", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      byType: (await tx.query("SELECT type, claim_class, count(*)::int AS n FROM entities GROUP BY type, claim_class ORDER BY n DESC")).rows,
      byClass: (await tx.query("SELECT relationship_class, count(*)::int AS n FROM entity_relationships GROUP BY relationship_class ORDER BY n DESC")).rows,
      snapshot: (await tx.query("SELECT id, entity_count, relationship_count, content_hash, created_at FROM graph_snapshots WHERE scope = 'institution' ORDER BY created_at DESC LIMIT 1")).rows[0] ?? null,
    }));
  });

  app.get("/graph/entities", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const q = z.object({ q: z.string().max(100).optional(), type: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      entities: (await tx.query(
        `SELECT e.id, e.key, e.type, e.name, e.country, e.claim_class,
                (SELECT count(*)::int FROM entity_relationships r WHERE r.subject_id = e.id OR r.object_id = e.id) AS degree
           FROM entities e
          WHERE ($1::text IS NULL OR e.name ILIKE '%' || $1 || '%' OR e.key ILIKE '%' || $1 || '%') AND ($2::text IS NULL OR e.type = $2)
          ORDER BY (e.type IN ('vessel','sanctions_regime','holding','mandate')), degree DESC, e.name LIMIT $3`, [q.q ?? null, q.type ?? null, q.limit])).rows,
    }));
  });

  app.get("/graph/entity", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().min(1).max(200) }).parse(req.query);
    const p = req.principal!;
    const data = await withTenant(p.institutionId, async (tx) => {
      const e = (await tx.query(
        `SELECT e.*, ev.title AS evidence_title, s.name AS source_name FROM entities e
           LEFT JOIN evidence_objects ev ON ev.id = e.evidence_id LEFT JOIN sources s ON s.id = ev.source_id
          WHERE e.key = $1 OR e.id::text = $1`, [key])).rows[0];
      if (!e) return undefined;
      const edges = (await tx.query(
        `SELECT r.id, r.predicate, r.predicate_label, r.relationship_class, r.impact_weight, r.confidence, r.status,
                CASE WHEN r.subject_id = $1 THEN 'out' ELSE 'in' END AS direction,
                o.key AS other_key, o.name AS other_name, o.type AS other_type, o.claim_class AS other_class,
                (SELECT json_agg(json_build_object('evidenceId', re.evidence_id, 'factId', re.fact_id, 'note', re.note, 'title', ev.title, 'source', s.name))
                   FROM relationship_evidence re JOIN evidence_objects ev ON ev.id = re.evidence_id JOIN sources s ON s.id = ev.source_id WHERE re.relationship_id = r.id) AS evidence
           FROM entity_relationships r JOIN entities o ON o.id = CASE WHEN r.subject_id = $1 THEN r.object_id ELSE r.subject_id END
          WHERE r.subject_id = $1 OR r.object_id = $1 ORDER BY direction DESC, r.predicate, o.name LIMIT 200`, [e.id])).rows;
      return { entity: e, edges };
    });
    return data ?? reply.code(404).send({ error: "not_found", message: "No such entity in this institution's graph." });
  });

  /** Nodes and edges around an entity, for the graph view. Bounded to keep the picture readable. */
  app.get("/graph/neighborhood", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const q = z.object({ key: z.string().min(1).max(200), depth: z.coerce.number().int().min(1).max(3).default(2), includeVessels: z.coerce.boolean().default(false) }).parse(req.query);
    const p = req.principal!;
    const data = await withTenant(p.institutionId, async (tx) => {
      const start = (await tx.query("SELECT id FROM entities WHERE key = $1 OR id::text = $1", [q.key])).rows[0];
      if (!start) return undefined;
      const r = await tx.query(
        `WITH RECURSIVE walk(id, depth) AS (
           SELECT $1::uuid, 0
           UNION
           SELECT CASE WHEN r.subject_id = w.id THEN r.object_id ELSE r.subject_id END, w.depth + 1
             FROM walk w JOIN entity_relationships r ON (r.subject_id = w.id OR r.object_id = w.id)
             JOIN entities o ON o.id = CASE WHEN r.subject_id = w.id THEN r.object_id ELSE r.subject_id END
            WHERE w.depth < $2 AND r.predicate <> 'located_in' AND ($3 OR o.type NOT IN ('vessel','sanctions_regime'))
         )
         SELECT id, min(depth) AS depth FROM walk GROUP BY id ORDER BY min(depth) LIMIT 160`, [start.id, q.depth, q.includeVessels]);
      const ids = r.rows.map((x) => x.id);
      const depth = new Map(r.rows.map((x) => [x.id, x.depth]));
      const nodes = (await tx.query("SELECT id, key, name, type, claim_class, lat, lon FROM entities WHERE id = ANY($1)", [ids])).rows.map((n) => ({ ...n, depth: depth.get(n.id) }));
      const edges = (await tx.query(
        `SELECT id, subject_id AS source, object_id AS target, predicate, predicate_label, relationship_class, impact_weight
           FROM entity_relationships WHERE subject_id = ANY($1) AND object_id = ANY($1) AND predicate <> 'located_in'`, [ids])).rows;
      return { origin: start.id, nodes, edges };
    });
    return data ?? reply.code(404).send({ error: "not_found", message: "No such entity in this institution's graph." });
  });

  /** Direct, second- and third-order impact paths from an entity (FR-16, TR-021). */
  app.get("/graph/paths", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const q = z.object({ from: z.string().min(1).max(200), depth: z.coerce.number().int().min(1).max(5).default(3), classes: z.string().optional() }).parse(req.query);
    const p = req.principal!;
    const data = await withTenant(p.institutionId, (tx) => impactPaths(tx, q.from, { maxDepth: q.depth, classes: q.classes ? q.classes.split(",") : undefined }));
    return data ?? reply.code(404).send({ error: "not_found", message: "No such entity in this institution's graph." });
  });
}

/** Map layers (MAP §2–3): every located entity from the graph plus active signals placed at their entities. */
export async function mapRoutes(app: FastifyInstance) {
  app.get("/map/layers", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      entities: (await tx.query(
        `SELECT key, name, type, country, lat, lon, claim_class, location_quality, attributes FROM entities
          WHERE lat IS NOT NULL AND type IN ('port','terminal','refinery','field','facility','pipeline','desalination','power_plant','airport','city','chokepoint','country')
          ORDER BY type, name`)).rows,
      signals: (await tx.query(
        `SELECT s.id, s.title, s.urgency, s.data_mode, s.status, s.event_time, e.key AS entity_key, e.lat, e.lon
           FROM signals s JOIN signal_entities se ON se.signal_id = s.id JOIN entities e ON e.id = se.entity_id
          WHERE s.status <> 'dismissed' AND e.lat IS NOT NULL AND e.type IN ('chokepoint','port','terminal','desalination','route','city')
          ORDER BY s.detected_at DESC`)).rows,
      generatedAt: new Date().toISOString(),
    }));
  });

  /** Observed aircraft from the latest imported ADS-B snapshot. Each value carries its fact id for lineage. */
  app.get("/map/observed-aircraft", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const ev = (await tx.query<{ id: string; retrieved_at: string; source_version: string }>(
        `SELECT e.id, e.retrieved_at, e.source_version FROM evidence_objects e JOIN sources s ON s.id = e.source_id
          WHERE s.key = 'adsb.gulf' AND e.duplicate_of IS NULL AND e.validation_state IN ('accepted','warning') ORDER BY e.retrieved_at DESC LIMIT 1`)).rows[0];
      if (!ev) return { capture: null, aircraft: [] };
      const rows = (await tx.query<{ id: string; subject: string; subject_label: string; predicate: string; value_num: number | null; value_text: string | null; unit: string | null; period: string | null; excerpt: string | null }>(
        "SELECT id, subject, subject_label, predicate, value_num, value_text, unit, period, excerpt FROM evidence_facts WHERE evidence_id = $1 AND review_state <> 'rejected'", [ev.id])).rows;
      const cap = rows.find((r) => r.subject === "adsb:gulf");
      const by = new Map<string, { callsign: string; observedAt: string | null; facts: Record<string, { id: string; num: number | null; text: string | null; unit: string | null }> }>();
      for (const r of rows) {
        if (!r.subject.startsWith("aircraft:")) continue;
        const v = by.get(r.subject) ?? { callsign: r.subject_label, observedAt: r.period, facts: {} };
        v.facts[r.predicate] = { id: r.id, num: r.value_num, text: r.value_text, unit: r.unit };
        by.set(r.subject, v);
      }
      const aircraft = [...by.entries()].filter(([, v]) => v.facts.position_lat && v.facts.position_lon).map(([key, v]) => ({
        key, hex: key.slice("aircraft:".length), callsign: v.callsign, observedAt: v.observedAt, kind: aircraftKind(v.facts.aircraft_type?.text, v.callsign),
        lat: v.facts.position_lat!.num!, lon: v.facts.position_lon!.num!, facts: v.facts,
      }));
      return { capture: { evidenceId: ev.id, retrievedAt: ev.retrieved_at, window: ev.source_version, summary: cap?.excerpt ?? null }, aircraft };
    });
  });

  /** Observed vessels from the latest imported AIS snapshot. Each value carries its fact id for lineage. */
  app.get("/map/observed-vessels", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const ev = (await tx.query<{ id: string; retrieved_at: string; source_version: string; validation_state: string }>(
        `SELECT e.id, e.retrieved_at, e.source_version, e.validation_state FROM evidence_objects e JOIN sources s ON s.id = e.source_id
          WHERE s.key = 'aisstream.hormuz' AND e.duplicate_of IS NULL AND e.validation_state IN ('accepted','warning') ORDER BY e.retrieved_at DESC, e.created_at DESC LIMIT 1`)).rows[0];
      if (!ev) return { capture: null, vessels: [] };
      const rows = (await tx.query<{ id: string; subject: string; subject_label: string; predicate: string; value_num: number | null; value_text: string | null; unit: string | null; period: string | null; excerpt: string | null }>(
        "SELECT id, subject, subject_label, predicate, value_num, value_text, unit, period, excerpt FROM evidence_facts WHERE evidence_id = $1 AND review_state <> 'rejected'", [ev.id])).rows;
      const capture = rows.find((r) => r.subject === "ais:hormuz");
      const by = new Map<string, { name: string; observedAt: string | null; facts: Record<string, { id: string; num: number | null; text: string | null; unit: string | null }> }>();
      for (const r of rows) {
        if (!r.subject.startsWith("vessel:mmsi:")) continue;
        const v = by.get(r.subject) ?? { name: r.subject_label, observedAt: r.period, facts: {} };
        v.facts[r.predicate] = { id: r.id, num: r.value_num, text: r.value_text, unit: r.unit };
        by.set(r.subject, v);
      }
      const vessels = [...by.entries()].filter(([, v]) => v.facts.position_lat && v.facts.position_lon).map(([key, v]) => {
        const t = shipType(v.facts.ship_type?.num ?? null);
        const { ais_track: trackFact, ...facts } = v.facts;
        let track: Array<{ at: string; lat: number; lon: number }> = [];
        try { track = trackFact?.text ? (JSON.parse(trackFact.text) as Array<{ at: string; lat: number; lon: number }>).map((p) => ({ at: p.at, lat: p.lat, lon: p.lon })) : []; } catch { track = []; }
        return { key, mmsi: key.slice("vessel:mmsi:".length), name: v.name, observedAt: v.observedAt, category: t.category, typeLabel: v.facts.ship_type?.text ?? t.label,
          lat: v.facts.position_lat!.num!, lon: v.facts.position_lon!.num!, facts: { ...facts, ...(trackFact ? { ais_track: { ...trackFact, text: null } } : {}) }, track };
      });
      return { capture: { evidenceId: ev.id, validation: ev.validation_state, retrievedAt: ev.retrieved_at, window: ev.source_version, summary: capture?.excerpt ?? null, countFactId: capture?.id ?? null }, vessels };
    });
  });
}
