import type { FastifyInstance } from "fastify";
import { appPool } from "../db";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const db = await appPool.query("SELECT 1 AS ok").then(() => "healthy").catch(() => "unavailable");
    return { service: "tigeris-api", status: db === "healthy" ? "healthy" : "degraded", components: { database: db }, time: new Date().toISOString() };
  });
}
