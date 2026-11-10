import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { ZodError } from "zod";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { governanceRoutes } from "./routes/governance";
import { adminRoutes } from "./routes/admin";
import { demoRoutes } from "./routes/demo";
import { evidenceRoutes } from "./routes/evidence";
import { graphRoutes, mapRoutes } from "./routes/graph";
import { workflowRoutes } from "./routes/workflow";
import { scenarioRoutes } from "./routes/scenarios";
import { aiRoutes } from "./routes/ai";
import { decisionRoutes } from "./routes/decisions";
import { securityRoutes } from "./routes/security";
import { sovereigntyRoutes } from "./routes/sovereignty";
import { intelRoutes } from "./routes/intel";
import { backtestRoutes } from "./routes/backtests";
import { diagnosticRoutes } from "./routes/diagnostic";
import { playbookRoutes } from "./routes/playbooks";
import { fundRoutes } from "./routes/fund";
import { engagementRoutes, packageRoutes } from "./routes/engagements";
import { reportRoutes } from "./routes/reports";

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info", redact: ["req.headers.cookie"] } });
  await app.register(cookie);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "invalid_request", message: "Some fields are missing or invalid.", issues: err.issues.map((i) => i.path.join(".")) });
    }
    if ((err as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send({ error: "too_large", message: "The file is larger than the upload limit for this kind of file." });
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
  await app.register(mapRoutes);
  await app.register(workflowRoutes);
  await app.register(scenarioRoutes);
  await app.register(aiRoutes);
  await app.register(decisionRoutes);
  await app.register(securityRoutes);
  await app.register(sovereigntyRoutes);
  await app.register(intelRoutes);
  await app.register(backtestRoutes);
  await app.register(diagnosticRoutes);
  await app.register(playbookRoutes);
  await app.register(fundRoutes);
  await app.register(engagementRoutes);
  await app.register(packageRoutes);
  await app.register(reportRoutes);
  return app;
}
