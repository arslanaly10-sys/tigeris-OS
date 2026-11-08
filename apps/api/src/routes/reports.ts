import type { FastifyInstance } from "fastify";
import { withTenant } from "../db";
import { requirePermission } from "../session";
import { activePolicy } from "../policy/store";
import { getSettings } from "../ai/gateway";
import { AGENTS } from "../agents/registry";

/** Reports module (Q044) and the live figures on the architecture page (Q057). */
export async function reportRoutes(app: FastifyInstance) {
  app.get("/reports", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const pol = await activePolicy(tx);
      return {
        briefs: (await tx.query(
          `SELECT DISTINCT ON (b.case_id) b.id, b.version, b.content->>'classification' AS classification, b.content_hash, b.created_at, b.created_by_label, c.case_key, c.title, c.state,
                  (SELECT count(*)::int FROM case_briefs x WHERE x.case_id = b.case_id) AS versions
             FROM case_briefs b JOIN cases c ON c.id = b.case_id ORDER BY b.case_id, b.version DESC`)).rows,
        backtests: (await tx.query("SELECT id, status, metrics, fitted, prior, run_by_label, adopted_by_label, created_at FROM backtest_runs ORDER BY created_at DESC LIMIT 5")).rows,
        governance: {
          policy: { version: pol.version, rules: pol.policy.rules.length, tests: pol.policy.tests.length, approvals: pol.policy.approvals.length, audiences: pol.policy.redaction.audiences.map((a) => a.label) },
          audit30: (await tx.query("SELECT action, count(*)::int AS n FROM audit_events WHERE occurred_at > now() - interval '30 days' GROUP BY action ORDER BY 2 DESC LIMIT 25")).rows,
          refusals30: (await tx.query("SELECT count(*)::int AS n FROM audit_events WHERE occurred_at > now() - interval '30 days' AND (action LIKE '%refused%' OR action LIKE '%blocked%' OR action = 'access.denied')")).rows[0].n,
          decisions: (await tx.query("SELECT status, count(*)::int AS n FROM decisions GROUP BY status")).rows,
          exports: (await tx.query("SELECT details->>'audience' AS audience, count(*)::int AS n, sum((details->>'redactions')::int)::int AS redactions FROM audit_events WHERE action = 'export.created' GROUP BY 1")).rows,
          models: (await tx.query("SELECT provider, outcome, count(*)::int AS n FROM model_calls GROUP BY provider, outcome ORDER BY provider")).rows,
        },
      };
    });
  });

  app.get("/architecture/stats", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const n = async (sql: string) => (await tx.query(sql)).rows[0].n as number;
      const s = await getSettings(tx);
      const pol = await activePolicy(tx);
      return {
        sources: await n("SELECT count(*)::int AS n FROM sources"),
        evidence: await n("SELECT count(*)::int AS n FROM evidence_objects"),
        facts: await n("SELECT count(*)::int AS n FROM evidence_facts"),
        entities: await n("SELECT count(*)::int AS n FROM entities"),
        relationships: await n("SELECT count(*)::int AS n FROM entity_relationships"),
        signals: await n("SELECT count(*)::int AS n FROM signals"),
        cases: await n("SELECT count(*)::int AS n FROM cases"),
        scenarioRuns: await n("SELECT count(*)::int AS n FROM scenario_runs"),
        agentRuns: await n("SELECT count(*)::int AS n FROM agent_runs"),
        decisions: await n("SELECT count(*)::int AS n FROM decisions"),
        precedents: await n("SELECT count(*)::int AS n FROM precedents WHERE status = 'approved'"),
        auditEvents: await n("SELECT count(*)::int AS n FROM audit_events"),
        agents: AGENTS.length, policyVersion: pol.version, policyRules: pol.policy.rules.length,
        foreignModels: s.foreign_models_enabled, outbound: s.outbound_allowed,
      };
    });
  });
}
