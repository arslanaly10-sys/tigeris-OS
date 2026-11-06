import { fileURLToPath } from "node:url";
import { closePools } from "../db";
import { resetDemo } from "./seed-data";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await resetDemo();
  console.log("demo data seeded");
  await closePools();
}
