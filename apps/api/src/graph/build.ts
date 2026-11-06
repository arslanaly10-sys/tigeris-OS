import { createHash } from "node:crypto";
import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { getObject } from "../evidence/vault";

/**
 * Deterministic graph build for one institution (FR-13..FR-15, TR-018, TR-019).
 * Every entity and relationship carries a claim class and points back to the evidence it came from:
 *  - curated reference geography → SOURCED structure, ILLUSTRATIVE capacities
 *  - sanctions lists → OBSERVED vessel designations
 *  - EIA analysis → SOURCED figures attached to the strait and pipelines
 *  - synthetic institution context → SYNTHETIC holdings and exposures
 * Upserts by stable key, so rebuilding is idempotent.
 */

interface EntityRow { key: string; type: string; name: string; country: string | null; lat: number | null; lon: number | null; quality: string | null; domains: string[]; attributes: Record<string, unknown>; claim: string; evidenceId: string | null }
interface RelRow { from: string; predicate: string; label: string; to: string; cls: string; weight: number | null; evidenceId: string; factId: string | null; note: string | null }

const LABELS: Record<string, string> = {
  located_in: "Located in", handles: "Handles", transits: "Ships transit", uses_route: "Uses route", feeds: "Feeds", ships_via: "Ships via",
  delivers_to: "Delivers to", bypasses: "Can bypass", produces: "Produces", depends_on: "Depends on", imports_food_via: "Imports food and goods via",
  imports: "Imports", leads_to: "Leads to", alternative_to: "Alternative to", imports_via: "Imports via", designated_under: "Designated under",
  held_by: "Held by", governed_by: "Governed by mandate", exposed_to: "Exposed to",
};

async function latestEvidence(tx: Tx, sourceKey: string) {
  return (await tx.query(
    `SELECT e.id, e.vault_key FROM evidence_objects e JOIN sources s ON s.id = e.source_id
      WHERE s.key = $1 AND e.validation_state IN ('accepted','warning') AND e.duplicate_of IS NULL ORDER BY e.created_at DESC`, [sourceKey])).rows;
}

async function upsertEntities(tx: Tx, inst: string, rows: EntityRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const p = rows.slice(i, i + 500);
    await tx.query(
      `INSERT INTO entities (institution_id, key, type, name, country, lat, lon, location_quality, domain_keys, attributes, claim_class, evidence_id, valid_from)
       SELECT $1, k, t, n, c, la, lo, q, string_to_array(d, ','), a::jsonb, cl, ev, now()
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[], $8::text[], $9::text[], $10::text[], $11::text[], $12::uuid[])
              AS x(k, t, n, c, la, lo, q, d, a, cl, ev)
       ON CONFLICT (institution_id, key) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
         attributes = entities.attributes || EXCLUDED.attributes, domain_keys = EXCLUDED.domain_keys, claim_class = EXCLUDED.claim_class, evidence_id = EXCLUDED.evidence_id`,
      [inst, p.map((r) => r.key), p.map((r) => r.type), p.map((r) => r.name), p.map((r) => r.country), p.map((r) => r.lat), p.map((r) => r.lon), p.map((r) => r.quality),
        p.map((r) => r.domains.join(",")), p.map((r) => JSON.stringify(r.attributes)), p.map((r) => r.claim), p.map((r) => r.evidenceId)],
    );
  }
}

async function upsertRelationships(tx: Tx, inst: string, rows: RelRow[]) {
  // One row per (subject, predicate, object); the later row wins, but every row's evidence is kept.
  const unique = [...new Map(rows.map((r) => [`${r.from}|${r.predicate}|${r.to}`, r])).values()];
  for (let i = 0; i < unique.length; i += 500) {
    const p = unique.slice(i, i + 500);
    await tx.query(
      `INSERT INTO entity_relationships (institution_id, subject_id, predicate, predicate_label, object_id, relationship_class, impact_weight, confidence, valid_from)
       SELECT $1, s.id, x.pr, x.lb, o.id, x.cl, x.w, CASE WHEN x.cl IN ('observed','sourced') THEN 'high' WHEN x.cl = 'synthetic' THEN 'medium' ELSE 'low' END, now()
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::float8[]) AS x(f, pr, lb, t, cl, w)
         JOIN entities s ON s.key = x.f JOIN entities o ON o.key = x.t
       ON CONFLICT (institution_id, subject_id, predicate, object_id) DO UPDATE SET relationship_class = EXCLUDED.relationship_class, impact_weight = EXCLUDED.impact_weight`,
      [inst, p.map((r) => r.from), p.map((r) => r.predicate), p.map((r) => r.label), p.map((r) => r.to), p.map((r) => r.cls), p.map((r) => r.weight)],
    );
  }
  for (let i = 0; i < rows.length; i += 500) {
    const p = rows.slice(i, i + 500);
    await tx.query(
      `INSERT INTO relationship_evidence (institution_id, relationship_id, evidence_id, fact_id, role, note)
       SELECT DISTINCT ON (er.id, x.e) $1::uuid, er.id, x.e, x.fa, 'supporting', x.n
         FROM unnest($2::text[], $3::text[], $4::text[], $5::uuid[], $6::uuid[], $7::text[]) AS x(f, pr, t, e, fa, n)
         JOIN entities s ON s.key = x.f JOIN entities o ON o.key = x.t
         JOIN entity_relationships er ON er.subject_id = s.id AND er.object_id = o.id AND er.predicate = x.pr
       ON CONFLICT DO NOTHING`,
      [inst, p.map((r) => r.from), p.map((r) => r.predicate), p.map((r) => r.to), p.map((r) => r.evidenceId), p.map((r) => r.factId), p.map((r) => r.note)],
    );
  }
}

export async function buildGraph(tx: Tx, institutionId: string, actorLabel = "Graph builder") {
  const entities: EntityRow[] = [];
  const rels: RelRow[] = [];
  const known = new Set<string>();
  const pushEntity = (e: EntityRow) => { if (!known.has(e.key)) { known.add(e.key); entities.push(e); } };

  // 1. Curated reference geography
  for (const ev of (await latestEvidence(tx, "tigeris.reference")).slice(0, 1)) {
    const ref = JSON.parse((await getObject(institutionId, ev.vault_key)).toString("utf8"));
    const factIds = new Map((await tx.query("SELECT subject, predicate, id, value_num, unit FROM evidence_facts WHERE evidence_id = $1", [ev.id])).rows.map((f) => [`${f.subject}|${f.predicate}`, f]));
    for (const e of ref.entities) {
      const attributes: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(e.attrs ?? {})) {
        const f = factIds.get(`${e.key}|${k}`);
        attributes[k] = f ? { value: f.value_num, unit: f.unit, factId: f.id, claim: "illustrative" } : v;
      }
      pushEntity({ key: e.key, type: e.type, name: e.name, country: e.country ?? null, lat: e.lat ?? null, lon: e.lon ?? null, quality: e.lat !== undefined ? "approximate (curated reference)" : null, domains: e.domains ?? [], attributes, claim: "sourced", evidenceId: ev.id });
    }
    for (const r of ref.relationships) {
      rels.push({ from: r.from, predicate: r.predicate, label: LABELS[r.predicate] ?? r.predicate, to: r.to, cls: "sourced", weight: r.weight ?? null, evidenceId: ev.id, factId: null, note: [r.note, r.weight !== undefined ? "Impact weight is an analyst assumption" : null].filter(Boolean).join(". ") || null });
    }
  }

  // 2. EIA figures attached to the strait and pipelines (SOURCED, with fact lineage)
  const eia = (await tx.query(
    `SELECT f.id, f.subject, f.predicate, f.predicate_label, f.value_num, f.unit, f.period, f.evidence_id FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key = 'eia.chokepoints' AND f.predicate <> 'stated_figure' AND e.duplicate_of IS NULL`)).rows;
  const eiaAttrs = new Map<string, Record<string, unknown>>();
  for (const f of eia) {
    const key = f.subject === "pipeline:adcop" ? "pipeline:adcop" : f.subject;
    eiaAttrs.set(key, { ...(eiaAttrs.get(key) ?? {}), [f.predicate]: { value: f.value_num, unit: f.unit, period: f.period, factId: f.id, claim: "sourced", label: f.predicate_label } });
    if (f.predicate === "bypass_capacity_available") {
      for (const p of ["pipeline:east-west", "pipeline:adcop"]) rels.push({ from: p, predicate: "bypasses", label: LABELS.bypasses!, to: "chokepoint:hormuz", cls: "sourced", weight: 0.8, evidenceId: f.evidence_id, factId: f.id, note: "EIA: about 2.6 million b/d of Saudi and UAE pipeline capacity could be available to bypass the strait" });
    }
    if (f.predicate === "oil_transit_flow") rels.push({ from: "commodity:crude", predicate: "transits", label: LABELS.transits!, to: "chokepoint:hormuz", cls: "sourced", weight: 0.9, evidenceId: f.evidence_id, factId: f.id, note: "EIA: about 20 million b/d of oil moved through the strait in 2024" });
  }

  // 3. Country indicators from World Bank and JODI (OBSERVED), latest value per measure
  const countryFacts = (await tx.query(
    `SELECT DISTINCT ON (f.subject, f.predicate) f.id, f.subject, f.predicate, f.predicate_label, f.value_num, f.unit, f.period
       FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key IN ('worldbank.wdi','jodi.oil') AND f.value_num IS NOT NULL AND e.duplicate_of IS NULL
      ORDER BY f.subject, f.predicate, f.period DESC`)).rows;
  for (const f of countryFacts) {
    const key = `country:${f.subject}`;
    eiaAttrs.set(key, { ...(eiaAttrs.get(key) ?? {}), [f.predicate]: { value: f.value_num, unit: f.unit, period: f.period, factId: f.id, claim: "observed", label: f.predicate_label } });
  }

  // 4. Sanctioned vessels (OBSERVED) and the regimes they are designated under
  const vessels = (await tx.query(
    `SELECT f.id, f.subject, f.subject_label, f.value_text, f.qualifier, f.excerpt, f.evidence_id, s.key AS source_key
       FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE f.predicate = 'sanctions_designation' AND e.duplicate_of IS NULL`)).rows;
  for (const v of vessels) {
    const list = v.source_key === "ofac.sdn" ? "OFAC" : "UK";
    const regimeKey = `regime:${list.toLowerCase()}:${String(v.value_text).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
    pushEntity({ key: regimeKey, type: "sanctions_regime", name: `${list} · ${v.value_text}`, country: null, lat: null, lon: null, quality: null, domains: ["insurance", "banking"], attributes: {}, claim: "observed", evidenceId: v.evidence_id });
    pushEntity({ key: v.subject, type: "vessel", name: v.subject_label, country: null, lat: null, lon: null, quality: null, domains: ["supply_chain", "insurance"], attributes: { imo: v.excerpt?.replace("IMO ", "") ?? null, details: v.qualifier ?? null }, claim: "observed", evidenceId: v.evidence_id });
    rels.push({ from: v.subject, predicate: "designated_under", label: LABELS.designated_under!, to: regimeKey, cls: "observed", weight: null, evidenceId: v.evidence_id, factId: v.id, note: null });
  }

  // 5. Synthetic institution context: only the file intended for this institution is ever imported
  for (const ev of (await latestEvidence(tx, "tigeris.synthetic")).slice(0, 1)) {
    const ctx = JSON.parse((await getObject(institutionId, ev.vault_key)).toString("utf8"));
    const values = new Map((await tx.query("SELECT subject, id, value_num FROM evidence_facts WHERE evidence_id = $1", [ev.id])).rows.map((f) => [f.subject, f]));
    pushEntity({ key: ctx.institution.key, type: "institution", name: ctx.institution.name, country: ctx.institution.country, lat: null, lon: null, quality: null, domains: ["sovereign_capital"], attributes: {}, claim: "synthetic", evidenceId: ev.id });
    for (const m of ctx.mandates) {
      pushEntity({ key: m.key, type: "mandate", name: m.name, country: null, lat: null, lon: null, quality: null, domains: ["sovereign_capital"], attributes: { limit: m.limit ?? null }, claim: "synthetic", evidenceId: ev.id });
      rels.push({ from: m.key, predicate: "governed_by", label: "Mandate of", to: ctx.institution.key, cls: "synthetic", weight: null, evidenceId: ev.id, factId: null, note: null });
    }
    for (const h of ctx.holdings) {
      const f = values.get(h.key);
      pushEntity({ key: h.key, type: "holding", name: h.name, country: h.country, lat: null, lon: null, quality: null, domains: ["sovereign_capital"], attributes: { sector: h.sector, assetClass: h.assetClass, value_usd: f ? { value: f.value_num, unit: "USD", factId: f.id, claim: "synthetic" } : h.valueUsdM * 1e6 }, claim: "synthetic", evidenceId: ev.id });
      rels.push({ from: h.key, predicate: "held_by", label: LABELS.held_by!, to: ctx.institution.key, cls: "synthetic", weight: null, evidenceId: ev.id, factId: f?.id ?? null, note: null });
      rels.push({ from: h.key, predicate: "governed_by", label: LABELS.governed_by!, to: h.mandate, cls: "synthetic", weight: null, evidenceId: ev.id, factId: null, note: null });
      for (const x of h.exposures) rels.push({ from: h.key, predicate: "exposed_to", label: LABELS.exposed_to!, to: x.entity, cls: "synthetic", weight: x.weight, evidenceId: ev.id, factId: null, note: x.channel });
    }
  }

  await upsertEntities(tx, institutionId, entities);
  for (const [key, attrs] of eiaAttrs) await tx.query("UPDATE entities SET attributes = attributes || $2::jsonb WHERE key = $1", [key, JSON.stringify(attrs)]);
  await upsertRelationships(tx, institutionId, rels);

  const counts = (await tx.query("SELECT (SELECT count(*)::int FROM entities) AS e, (SELECT count(*)::int FROM entity_relationships) AS r")).rows[0];
  const keys = (await tx.query("SELECT string_agg(key, ',' ORDER BY key) AS k FROM entities")).rows[0].k ?? "";
  const hash = createHash("sha256").update(keys).digest("hex");
  await tx.query("INSERT INTO graph_snapshots (institution_id, scope, entity_count, relationship_count, content_hash, created_by_label) VALUES ($1,'institution',$2,$3,$4,$5)", [institutionId, counts.e, counts.r, hash, actorLabel]);
  await appendAudit(tx, institutionId, { actorType: "service", actorId: "graph-builder", actorLabel, action: "graph.built", resourceType: "graph", details: { entities: counts.e, relationships: counts.r, contentHash: hash } });
  return { entities: counts.e as number, relationships: counts.r as number, hash };
}
