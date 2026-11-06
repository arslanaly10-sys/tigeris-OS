// Converts Natural Earth (via world-atlas, public domain) into GeoJSON served from /geo.
// The map needs no tile server and no network: everything ships with the app (Q079, TRD §13).
import { readFileSync, writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";

const read = (f) => JSON.parse(readFileSync(new URL(`../node_modules/world-atlas/${f}`, import.meta.url)));
const round = (g) => JSON.parse(JSON.stringify(g, (_k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));
const REGION = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Oman", "Bahrain", "Iran", "Iraq", "Yemen", "Egypt", "Jordan", "Eritrea", "Djibouti", "Sudan", "Israel", "Syria", "Pakistan", "Somalia", "Ethiopia"];
const GCC = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Oman", "Bahrain"];
const countries = read("countries-50m.json");
const land = read("land-50m.json");
const out = {
  "land.geojson": feature(land, land.objects.land),
  // Only the region's countries are drawn as highlighted shapes; the rest of the world is plain land.
  "countries.geojson": { type: "FeatureCollection", features: feature(countries, countries.objects.countries).features.filter((f) => REGION.includes(f.properties.name)) },
  "borders.geojson": { type: "Feature", properties: {}, geometry: mesh(countries, countries.objects.countries, (a, b) => a !== b) },
};
for (const f of out["countries.geojson"].features) f.properties.gcc = GCC.includes(f.properties.name);
for (const [name, g] of Object.entries(out)) {
  const json = JSON.stringify(round(g));
  writeFileSync(new URL(`../public/geo/${name}`, import.meta.url), json);
  console.log(name, (json.length / 1024).toFixed(0), "KB");
}
writeFileSync(new URL("../public/geo/ATTRIBUTION.txt", import.meta.url), "Base geography: Natural Earth (public domain), via world-atlas 2.0.2.\n");
