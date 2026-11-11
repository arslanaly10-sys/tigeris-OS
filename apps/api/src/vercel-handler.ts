import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./server";

/**
 * Hosted entry (Vercel Build Output API): one Node function serves every API route through the same Fastify app as
 * src/index.ts. The app is built once per instance and reused across requests.
 */
const ready = buildApp().then(async (app) => { await app.ready(); return app; });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await ready;
  app.server.emit("request", req, res);
}
