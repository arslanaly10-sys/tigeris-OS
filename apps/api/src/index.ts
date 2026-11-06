import { buildApp } from "./server";
import { config } from "./config";

const app = await buildApp();
await app.listen({ port: config.port, host: "0.0.0.0" });
