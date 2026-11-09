import type { FastifyInstance } from "fastify";
import { ANOMALY_LABEL, SCRIPTED_SHIPS, THRESHOLDS, detectScripted } from "@tigeris/shared";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { anomalyTime, correlate, realAnomalies, sourcePackage } from "../intel/correlation";

/** Voyage anomalies and intelligence correlation (slice 4). */
export async function intelRoutes(app: FastifyInstance) {
  app.get("/anomalies", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const signals = (await tx.query("SELECT id, key FROM signals WHERE key LIKE 'anomaly:%'")).rows as Array<{ id: string; key: string }>;
      const real = await realAnomalies(tx);
      return {
        thresholds: THRESHOLDS,
        ships: SCRIPTED_SHIPS.map((s) => ({ id: s.id, name: s.name, type: s.type, behaviour: s.behaviour, waypoints: s.waypoints, dark: s.dark ?? null })),
        anomalies: detectScripted().map((a) => ({ ...a, label: ANOMALY_LABEL[a.kind], at: anomalyTime(a.startMin).toISOString(), until: anomalyTime(a.endMin).toISOString(), signalId: signals.find((s) => s.key === `anomaly:${a.id}`)?.id ?? null, dataMode: "simulated" })),
        real: {
          vessels: real.vessels, assessed: real.assessed,
          anomalies: real.anomalies.map((a) => ({ ...a, label: ANOMALY_LABEL[a.kind], dataMode: "observed", signalId: signals.find((s) => s.key === `anomaly:${a.id}`)?.id ?? null })),
          note: !real.vessels ? "No real AIS snapshot imported." : real.assessed ? `${real.assessed} of ${real.vessels} real AIS ships had a track long enough to check (three or more reports); ${real.anomalies.length} anomal${real.anomalies.length === 1 ? "y" : "ies"} found.` : `${real.vessels} real AIS ships imported, none with a track long enough to check (three or more reports). Capture a longer window with the collector.`,
        },
      };
    });
  });

  app.get("/correlation", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({ findings: await correlate(tx), generatedAt: new Date().toISOString() }));
  });

  /** Downloads a finding's source package and records the export on the audit chain. */
  app.get("/correlation/:id/package", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const p = req.principal!;
    const { id } = req.params as { id: string };
    return withTenant(p.institutionId, async (tx) => {
      const f = (await correlate(tx)).find((x) => x.id === id);
      if (!f) return reply.code(404).send({ error: "not_found", message: "That finding is not current. Reload the correlation view and try again." });
      const inst = (await tx.query("SELECT name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const pkg = await sourcePackage(tx, f, { name: p.displayName, role: p.role, institution: inst.name });
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "correlation.package_exported", resourceType: "finding", resourceId: f.id, details: { sha256: pkg.sha256, members: f.members.length, leading: f.leading } });
      reply.header("content-type", "application/json; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="tigeris-source-package-${f.id}.json"`);
      reply.header("x-content-sha256", pkg.sha256);
      return reply.send(pkg.json);
    });
  });
}
