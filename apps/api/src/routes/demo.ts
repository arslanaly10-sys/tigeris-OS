import type { FastifyInstance } from "fastify";
import { requirePermission } from "../session";
import { resetDemo } from "../scripts/seed-data";
import { config } from "../config";

export async function demoRoutes(app: FastifyInstance) {
  /** One-click reset to the clean demo state (Q117). Signs everyone out. */
  app.post("/demo/reset", { preHandler: requirePermission() }, async (_req, reply) => {
    await resetDemo();
    reply.clearCookie(config.cookieName, { path: "/" });
    return { status: "reset" };
  });
}
