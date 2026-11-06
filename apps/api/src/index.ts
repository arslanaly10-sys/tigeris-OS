import { buildApp } from "./server";
import { config } from "./config";
import { startWorker } from "./evidence/jobs";

const app = await buildApp();
await app.listen({ port: config.port, host: "0.0.0.0" });
startWorker();
