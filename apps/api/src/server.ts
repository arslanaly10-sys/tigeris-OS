import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { ZodError } from "zod";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { governanceRoutes } from "./routes/governance";
import { adminRoutes } from "./routes/admin";
import { demoRoutes } from "./routes/demo";
import { evidenceRoutes } from "./routes/evidence";
import { graphRoutes } from "./routes/graph";
import { workflowRoutes } from "./routes/workflow";

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info", redact: ["req.headers.cookie"] } });
  await app.register(cookie);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "invalid_request", message: "Some fields are missing or invalid.", issues: err.issues.map((i) => i.path.join(".")) });
    }
    app.log.error(err);
    // Never expose stack traces or internals to the client (TRD §11.2).
    return reply.code(500).send({ error: "internal", message: "Something went wrong on the server. The error was logged." });
  });
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(governanceRoutes);
  await app.register(adminRoutes);
  await app.register(demoRoutes);
  await app.register(evidenceRoutes);
  await app.register(graphRoutes);
  await app.register(workflowRoutes);
  return app;
}
