import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { requirePermission, type Principal } from "../session";
import { createEngagement, editAssumption, editInput, loadEngagement } from "../workflow/engagements";

const actorOf = (p: Principal) => ({ id: p.principalId, label: p.displayName, role: p.role });
const intakeSchema = z.object({
  fullName: z.string().trim().min(2).max(120), title: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), phone: z.string().max(60).optional(),
  organisation: z.string().trim().min(2).max(200), website: z.string().max(200).optional(), category: z.string().max(80), jurisdiction: z.string().max(80),
  interests: z.array(z.string().max(80)).max(8), posture: z.string().max(80), challenge: z.string().trim().min(10).max(2000), window: z.string().max(40), format: z.string().max(60),
  aumUsd: z.number().positive().max(1e13).nullable().optional(),
});

export async function engagementRoutes(app: FastifyInstance) {
  app.get("/engagements", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({ engagements: (await tx.query("SELECT id, title, status, data_mode, rubric_version, created_by_label, created_at, intake->>'organisation' AS organisation FROM engagements ORDER BY created_at DESC")).rows }));
  });
  app.post("/engagements", { preHandler: requirePermission("diagnostic.run") }, async (req) => {
    const intake = intakeSchema.parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({ engagementId: await createEngagement(tx, p.institutionId, actorOf(p), intake) }));
  });
  app.get("/engagements/:id", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => loadEngagement(tx, id));
    return r ?? reply.code(404).send({ error: "not_found", message: "No such engagement." });
  });
  app.put("/engagements/:id/inputs/:metric", { preHandler: requirePermission("diagnostic.run") }, async (req, reply) => {
    const { id, metric } = z.object({ id: z.string().uuid(), metric: z.string().max(60) }).parse(req.params);
    const b = z.object({ value: z.number().finite().nullable(), note: z.string().max(500).default("") }).parse(req.body);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => editInput(tx, p.institutionId, actorOf(p), id, metric, b.value, b.note));
    return r.status === 200 ? r : reply.code(r.status).send({ error: "refused", message: r.message });
  });
  app.put("/engagements/:id/assumptions/:key", { preHandler: requirePermission("diagnostic.run") }, async (req, reply) => {
    const { id, key } = z.object({ id: z.string().uuid(), key: z.string().max(60) }).parse(req.params);
    const { value } = z.object({ value: z.number().finite() }).parse(req.body);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => editAssumption(tx, p.institutionId, actorOf(p), id, key, value));
    return r.status === 200 ? r : reply.code(r.status).send({ error: "refused", message: r.message });
  });
}
