// Bundles the API into a single Vercel function (Build Output API v3) at .vercel/output.
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".vercel/output");
const fn = path.join(out, "functions/index.func");
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: [path.join(root, "src/vercel-handler.ts")],
  bundle: true, platform: "node", format: "esm", target: "node22",
  outfile: path.join(fn, "index.mjs"),
  external: ["pg-native", "pdfjs-dist", "pdfjs-dist/*"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
writeFileSync(path.join(fn, ".vc-config.json"), JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", supportsResponseStreaming: true, maxDuration: 60 }, null, 2));
writeFileSync(path.join(out, "config.json"), JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }, null, 2));
console.log("vercel output written");
