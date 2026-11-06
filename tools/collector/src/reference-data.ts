/**
 * Curated GCC reference geography (Q042, Q043, Q044, Q046).
 * Real place names and approximate coordinates; no operators or companies are named.
 * Capacities are rounded public-domain orders of magnitude, marked ILLUSTRATIVE until validated
 * against the institution's own GIS and asset registry.
 */
export interface RefEntity {
  key: string;
  type: string;
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
  domains: string[];
  attrs?: Record<string, number | string>;
}
export interface RefRel { from: string; predicate: string; to: string; weight?: number; note?: string }

const E: RefEntity[] = [];
const R: RefRel[] = [];
const add = (type: string, domains: string[], rows: Array<[string, string, string | undefined, number | undefined, number | undefined, Record<string, number | string>?]>) => {
  for (const [key, name, country, lat, lon, attrs] of rows) E.push({ key, type, name, country, lat, lon, domains, attrs });
};
const rel = (from: string, predicate: string, to: string, weight?: number, note?: string) => R.push({ from, predicate, to, weight, note });

// Countries and neighbouring context
add("country", ["sovereign_capital"], [
  ["country:SAU", "Saudi Arabia", "SAU", 24.0, 45.0], ["country:ARE", "United Arab Emirates", "ARE", 24.2, 54.4], ["country:QAT", "Qatar", "QAT", 25.3, 51.2],
  ["country:KWT", "Kuwait", "KWT", 29.3, 47.7], ["country:OMN", "Oman", "OMN", 21.0, 57.0], ["country:BHR", "Bahrain", "BHR", 26.07, 50.55],
  ["country:IRN", "Iran", "IRN", 32.0, 53.0], ["country:IRQ", "Iraq", "IRQ", 33.0, 44.0], ["country:YEM", "Yemen", "YEM", 15.5, 47.5], ["country:EGY", "Egypt", "EGY", 26.8, 30.8],
]);
const GCC = ["SAU", "ARE", "QAT", "KWT", "OMN", "BHR"];

add("chokepoint", ["energy", "supply_chain"], [
  ["chokepoint:hormuz", "Strait of Hormuz", undefined, 26.57, 56.25], ["chokepoint:bab-el-mandeb", "Bab el-Mandeb", undefined, 12.58, 43.33],
  ["chokepoint:suez", "Suez Canal", "EGY", 30.6, 32.33], ["chokepoint:malacca", "Strait of Malacca", undefined, 2.5, 101.4],
]);
add("route", ["supply_chain"], [
  ["route:cape", "Cape of Good Hope route", undefined, -34.36, 18.47], ["route:gulf-of-oman", "Gulf of Oman approaches", undefined, 24.8, 58.0],
  ["route:red-sea", "Red Sea corridor", undefined, 20.0, 38.8], ["route:arabian-sea", "Arabian Sea route to Asia", undefined, 15.0, 63.0],
  ["route:persian-gulf", "Persian Gulf shipping lanes", undefined, 27.0, 51.5],
]);
add("market", ["energy", "supply_chain"], [
  ["market:china", "China (import market)", undefined, 31.2, 121.5], ["market:india", "India (import market)", undefined, 19.0, 72.8],
  ["market:japan", "Japan (import market)", undefined, 35.4, 139.6], ["market:korea", "South Korea (import market)", undefined, 35.1, 129.0],
  ["market:europe", "Europe (import market)", undefined, 51.9, 4.5], ["market:usa", "United States (import market)", undefined, 29.7, -95.0],
]);
add("commodity", ["energy", "supply_chain"], [
  ["commodity:crude", "Crude oil and condensate", undefined, undefined, undefined], ["commodity:lng", "Liquefied natural gas", undefined, undefined, undefined],
  ["commodity:products", "Refined products", undefined, undefined, undefined], ["commodity:containers", "Containerised goods", undefined, undefined, undefined],
  ["commodity:grain", "Grain and staple food imports", undefined, undefined, undefined], ["commodity:petchem", "Petrochemicals", undefined, undefined, undefined],
]);

// Ports and terminals: inside = inside the Strait of Hormuz
const ports: Array<[string, string, string, number, number, "inside" | "outside" | "red_sea", string[]]> = [
  ["port:ras-tanura", "Ras Tanura terminal", "SAU", 26.64, 50.16, "inside", ["crude", "products"]],
  ["port:juaymah", "Ju'aymah terminal", "SAU", 26.85, 50.0, "inside", ["crude"]],
  ["port:dammam", "King Abdulaziz Port, Dammam", "SAU", 26.5, 50.2, "inside", ["containers", "grain"]],
  ["port:jubail", "Jubail industrial port", "SAU", 26.96, 49.75, "inside", ["petchem", "products"]],
  ["port:ras-al-khair", "Ras Al-Khair port", "SAU", 27.48, 49.27, "inside", ["products"]],
  ["port:jeddah", "Jeddah Islamic Port", "SAU", 21.47, 39.17, "red_sea", ["containers", "grain"]],
  ["port:king-abdullah", "King Abdullah Port", "SAU", 22.5, 39.1, "red_sea", ["containers"]],
  ["port:yanbu", "Yanbu industrial port", "SAU", 23.95, 38.25, "red_sea", ["crude", "products", "petchem"]],
  ["port:jizan", "Jizan port", "SAU", 16.9, 42.55, "red_sea", ["products", "grain"]],
  ["port:jebel-ali", "Jebel Ali port", "ARE", 25.01, 55.06, "inside", ["containers", "grain", "products"]],
  ["port:khalifa", "Khalifa Port", "ARE", 24.81, 54.65, "inside", ["containers"]],
  ["port:zayed", "Port Zayed", "ARE", 24.52, 54.38, "inside", ["containers"]],
  ["port:ruwais", "Ruwais terminal", "ARE", 24.11, 52.73, "inside", ["products", "petchem"]],
  ["port:das-island", "Das Island terminal", "ARE", 25.15, 52.87, "inside", ["crude", "lng"]],
  ["port:jebel-dhanna", "Jebel Dhanna terminal", "ARE", 24.18, 52.6, "inside", ["crude"]],
  ["port:fujairah", "Fujairah port and oil terminal", "ARE", 25.17, 56.36, "outside", ["crude", "products"]],
  ["port:khor-fakkan", "Khor Fakkan container terminal", "ARE", 25.35, 56.36, "outside", ["containers"]],
  ["port:sharjah", "Port Khalid, Sharjah", "ARE", 25.36, 55.38, "inside", ["containers"]],
  ["port:hamad", "Hamad Port", "QAT", 25.0, 51.6, "inside", ["containers", "grain"]],
  ["port:ras-laffan", "Ras Laffan port", "QAT", 25.92, 51.55, "inside", ["lng", "products"]],
  ["port:mesaieed", "Mesaieed port", "QAT", 24.99, 51.55, "inside", ["crude", "petchem"]],
  ["port:shuwaikh", "Shuwaikh port", "KWT", 29.35, 47.93, "inside", ["containers", "grain"]],
  ["port:shuaiba", "Shuaiba port", "KWT", 29.03, 48.16, "inside", ["products", "containers"]],
  ["port:mina-al-ahmadi", "Mina Al-Ahmadi terminal", "KWT", 29.07, 48.15, "inside", ["crude", "products"]],
  ["port:sohar", "Sohar port", "OMN", 24.5, 56.62, "outside", ["containers", "products"]],
  ["port:duqm", "Duqm port", "OMN", 19.67, 57.71, "outside", ["products", "containers"]],
  ["port:salalah", "Salalah port", "OMN", 16.94, 54.0, "outside", ["containers"]],
  ["port:muscat", "Sultan Qaboos port, Muscat", "OMN", 23.63, 58.57, "outside", ["containers"]],
  ["port:mina-al-fahal", "Mina Al Fahal terminal", "OMN", 23.63, 58.52, "outside", ["crude"]],
  ["port:qalhat", "Qalhat LNG terminal", "OMN", 22.68, 59.38, "outside", ["lng"]],
  ["port:khalifa-bin-salman", "Khalifa Bin Salman port", "BHR", 26.19, 50.66, "inside", ["containers", "grain"]],
  ["port:sitra", "Sitra terminal", "BHR", 26.15, 50.65, "inside", ["products"]],
  ["port:basra", "Basra oil terminal", "IRQ", 29.68, 48.81, "inside", ["crude"]],
  ["port:kharg", "Kharg Island terminal", "IRN", 29.24, 50.32, "inside", ["crude"]],
  ["port:bandar-abbas", "Bandar Abbas port", "IRN", 27.14, 56.21, "inside", ["containers"]],
  ["port:jask", "Bandar-e-Jask terminal", "IRN", 25.64, 57.77, "outside", ["crude"]],
  ["port:aden", "Aden port", "YEM", 12.79, 44.97, "red_sea", ["containers"]],
  ["port:ain-sukhna", "Ain Sukhna port", "EGY", 29.6, 32.35, "red_sea", ["crude", "containers"]],
];
for (const [key, name, country, lat, lon, zone, goods] of ports) {
  E.push({ key, type: goods.includes("crude") || goods.includes("lng") ? "terminal" : "port", name, country, lat, lon, domains: ["supply_chain", "energy"], attrs: { zone: zone === "inside" ? "Inside the Strait of Hormuz" : zone === "red_sea" ? "Red Sea coast" : "Outside the Strait of Hormuz" } });
  rel(key, "located_in", `country:${country}`);
  for (const g of goods) rel(key, "handles", `commodity:${g}`, 0.6);
  if (zone === "inside") rel(key, "transits", "chokepoint:hormuz", goods.includes("crude") || goods.includes("lng") ? 0.95 : 0.85, "Seaborne traffic from this port leaves the Gulf through the strait");
  if (zone === "red_sea") rel(key, "uses_route", "route:red-sea", 0.7);
  if (zone === "outside") rel(key, "uses_route", "route:gulf-of-oman", 0.6);
}

add("field", ["energy"], [
  ["field:ghawar", "Ghawar oil field", "SAU", 25.4, 49.6], ["field:safaniya", "Safaniya offshore field", "SAU", 28.0, 48.8], ["field:khurais", "Khurais field", "SAU", 25.07, 48.08],
  ["field:shaybah", "Shaybah field", "SAU", 22.51, 53.97], ["field:manifa", "Manifa field", "SAU", 27.65, 48.98], ["field:upper-zakum", "Upper Zakum offshore field", "ARE", 24.9, 53.6],
  ["field:bab", "Bab onshore field", "ARE", 23.6, 53.8], ["field:north-field", "North Field (gas)", "QAT", 26.2, 51.9], ["field:burgan", "Burgan field", "KWT", 28.95, 47.95],
  ["field:fahud", "Fahud field", "OMN", 22.33, 56.48], ["field:awali", "Awali field", "BHR", 26.06, 50.55],
]);
add("facility", ["energy"], [["facility:abqaiq", "Abqaiq processing centre", "SAU", 25.93, 49.67, { illustrative_capacity_mbd: 7 }], ["facility:habshan", "Habshan processing hub", "ARE", 23.83, 53.67]]);
for (const [f, c] of [["field:ghawar", "SAU"], ["field:safaniya", "SAU"], ["field:khurais", "SAU"], ["field:shaybah", "SAU"], ["field:manifa", "SAU"], ["field:upper-zakum", "ARE"], ["field:bab", "ARE"], ["field:north-field", "QAT"], ["field:burgan", "KWT"], ["field:fahud", "OMN"], ["field:awali", "BHR"]] as const) rel(f, "located_in", `country:${c}`);
for (const f of ["field:ghawar", "field:khurais", "field:shaybah"]) rel(f, "feeds", "facility:abqaiq", 0.9);
rel("facility:abqaiq", "located_in", "country:SAU"); rel("facility:habshan", "located_in", "country:ARE");
rel("field:bab", "feeds", "facility:habshan", 0.9);
rel("facility:abqaiq", "ships_via", "port:ras-tanura", 0.6); rel("facility:abqaiq", "ships_via", "port:juaymah", 0.5);
rel("field:safaniya", "ships_via", "port:ras-tanura", 0.6); rel("field:manifa", "ships_via", "port:juaymah", 0.5);
rel("field:upper-zakum", "ships_via", "port:das-island", 0.8); rel("field:north-field", "ships_via", "port:ras-laffan", 0.95);
rel("field:burgan", "ships_via", "port:mina-al-ahmadi", 0.9); rel("field:fahud", "ships_via", "port:mina-al-fahal", 0.9); rel("field:awali", "feeds", "refinery:sitra", 0.7);

add("pipeline", ["energy"], [
  ["pipeline:east-west", "East-West crude oil pipeline", "SAU", 24.7, 44.0, { route: "Abqaiq to Yanbu" }],
  ["pipeline:adcop", "Habshan–Fujairah crude oil pipeline", "ARE", 24.5, 55.0, { route: "Habshan to Fujairah" }],
  ["pipeline:goreh-jask", "Goreh–Jask pipeline", "IRN", 28.0, 54.0, { route: "Goreh to Jask" }],
  ["pipeline:dolphin", "Dolphin gas pipeline", "QAT", 25.5, 53.0, { route: "Ras Laffan to Taweelah" }],
  ["pipeline:ab-bahrain", "Saudi–Bahrain crude pipeline", "SAU", 26.1, 50.2, { route: "Abqaiq to Sitra" }],
  ["pipeline:sumed", "SUMED pipeline", "EGY", 30.0, 31.0, { route: "Ain Sukhna to the Mediterranean" }],
]);
rel("facility:abqaiq", "feeds", "pipeline:east-west", 0.6); rel("pipeline:east-west", "delivers_to", "port:yanbu", 0.9);
rel("pipeline:east-west", "bypasses", "chokepoint:hormuz", 0.8, "Moves Gulf crude to the Red Sea coast");
rel("facility:habshan", "feeds", "pipeline:adcop", 0.6); rel("pipeline:adcop", "delivers_to", "port:fujairah", 0.9);
rel("pipeline:adcop", "bypasses", "chokepoint:hormuz", 0.8, "Moves Abu Dhabi crude to the Gulf of Oman");
rel("pipeline:goreh-jask", "delivers_to", "port:jask", 0.7); rel("pipeline:goreh-jask", "bypasses", "chokepoint:hormuz", 0.3);
rel("field:north-field", "feeds", "pipeline:dolphin", 0.5); rel("facility:abqaiq", "feeds", "pipeline:ab-bahrain", 0.3); rel("pipeline:ab-bahrain", "delivers_to", "refinery:sitra", 0.8);
rel("port:ain-sukhna", "feeds", "pipeline:sumed", 0.6);

const refineries: Array<[string, string, string, number, number, number, string]> = [
  ["refinery:ras-tanura", "Ras Tanura refinery", "SAU", 26.65, 50.15, 550, "port:ras-tanura"],
  ["refinery:jubail", "Jubail refinery complex", "SAU", 27.0, 49.6, 700, "port:jubail"],
  ["refinery:yanbu", "Yanbu refinery complex", "SAU", 24.0, 38.2, 800, "port:yanbu"],
  ["refinery:jazan", "Jazan refinery", "SAU", 16.75, 42.65, 400, "port:jizan"],
  ["refinery:riyadh", "Riyadh refinery", "SAU", 24.55, 46.85, 125, "port:dammam"],
  ["refinery:rabigh", "Rabigh refinery", "SAU", 22.75, 39.05, 400, "port:jeddah"],
  ["refinery:ruwais", "Ruwais refinery", "ARE", 24.1, 52.7, 900, "port:ruwais"],
  ["refinery:jebel-ali", "Jebel Ali refinery", "ARE", 25.0, 55.1, 140, "port:jebel-ali"],
  ["refinery:laffan", "Laffan refinery", "QAT", 25.9, 51.55, 290, "port:ras-laffan"],
  ["refinery:mesaieed", "Mesaieed refinery", "QAT", 24.98, 51.55, 140, "port:mesaieed"],
  ["refinery:al-zour", "Al-Zour refinery", "KWT", 28.72, 48.37, 600, "port:shuaiba"],
  ["refinery:mina-al-ahmadi", "Mina Al-Ahmadi refinery", "KWT", 29.06, 48.14, 350, "port:mina-al-ahmadi"],
  ["refinery:sohar", "Sohar refinery", "OMN", 24.47, 56.65, 200, "port:sohar"],
  ["refinery:duqm", "Duqm refinery", "OMN", 19.6, 57.6, 230, "port:duqm"],
  ["refinery:mina-al-fahal", "Mina Al Fahal refinery", "OMN", 23.62, 58.5, 100, "port:mina-al-fahal"],
  ["refinery:sitra", "Sitra refinery", "BHR", 26.15, 50.63, 380, "port:sitra"],
];
for (const [key, name, country, lat, lon, kbd, port] of refineries) {
  E.push({ key, type: "refinery", name, country, lat, lon, domains: ["energy", "manufacturing"], attrs: { illustrative_capacity_kbd: kbd } });
  rel(key, "located_in", `country:${country}`); rel(key, "ships_via", port, 0.8); rel(key, "produces", "commodity:products", 0.9);
}

// Water and power: co-located plants, cities depend on both
const utilities: Array<[string, string, string, number, number, string, string[]]> = [
  ["ras-al-khair", "Ras Al-Khair", "SAU", 27.48, 49.25, "power", ["city:riyadh", "city:dammam"]],
  ["jubail", "Jubail", "SAU", 27.05, 49.55, "power", ["city:dammam", "city:riyadh"]],
  ["shoaiba", "Shoaiba", "SAU", 20.68, 39.52, "power", ["city:jeddah", "city:mecca"]],
  ["shuqaiq", "Shuqaiq", "SAU", 17.7, 42.05, "power", ["city:jizan"]],
  ["yanbu", "Yanbu", "SAU", 24.05, 38.1, "power", ["city:medina"]],
  ["rabigh", "Rabigh", "SAU", 22.8, 39.0, "power", ["city:jeddah"]],
  ["taweelah", "Taweelah", "ARE", 24.77, 54.69, "power", ["city:abu-dhabi"]],
  ["jebel-ali", "Jebel Ali", "ARE", 25.06, 55.12, "power", ["city:dubai"]],
  ["fujairah", "Fujairah", "ARE", 25.14, 56.34, "power", ["city:sharjah", "city:fujairah"]],
  ["mirfa", "Mirfa", "ARE", 24.12, 53.44, "power", ["city:abu-dhabi"]],
  ["ras-abu-fontas", "Ras Abu Fontas", "QAT", 25.2, 51.62, "power", ["city:doha"]],
  ["umm-al-houl", "Umm Al Houl", "QAT", 24.94, 51.58, "power", ["city:doha"]],
  ["doha-west", "Doha West", "KWT", 29.36, 47.82, "power", ["city:kuwait-city"]],
  ["az-zour", "Az-Zour", "KWT", 28.72, 48.37, "power", ["city:kuwait-city"]],
  ["sabiya", "Sabiya", "KWT", 29.57, 48.16, "power", ["city:kuwait-city"]],
  ["barka", "Barka", "OMN", 23.7, 57.89, "power", ["city:muscat"]],
  ["sur", "Sur", "OMN", 22.58, 59.52, "power", ["city:muscat"]],
  ["salalah", "Salalah", "OMN", 17.0, 54.1, "power", ["city:salalah"]],
  ["al-dur", "Al Dur", "BHR", 25.97, 50.62, "power", ["city:manama"]],
  ["hidd", "Hidd", "BHR", 26.23, 50.66, "power", ["city:manama"]],
];
const cities: Array<[string, string, string, number, number]> = [
  ["city:riyadh", "Riyadh", "SAU", 24.71, 46.68], ["city:jeddah", "Jeddah", "SAU", 21.49, 39.19], ["city:dammam", "Dammam", "SAU", 26.43, 50.1],
  ["city:mecca", "Mecca", "SAU", 21.39, 39.86], ["city:medina", "Medina", "SAU", 24.47, 39.61], ["city:jizan", "Jizan", "SAU", 16.89, 42.57],
  ["city:abu-dhabi", "Abu Dhabi", "ARE", 24.45, 54.38], ["city:dubai", "Dubai", "ARE", 25.2, 55.27], ["city:sharjah", "Sharjah", "ARE", 25.35, 55.42],
  ["city:fujairah", "Fujairah", "ARE", 25.12, 56.33], ["city:doha", "Doha", "QAT", 25.29, 51.53], ["city:kuwait-city", "Kuwait City", "KWT", 29.37, 47.98],
  ["city:muscat", "Muscat", "OMN", 23.59, 58.41], ["city:salalah", "Salalah", "OMN", 17.02, 54.09], ["city:sohar", "Sohar", "OMN", 24.36, 56.75],
  ["city:manama", "Manama", "BHR", 26.23, 50.59],
];
for (const [key, name, country, lat, lon] of cities) { E.push({ key, type: "city", name, country, lat, lon, domains: ["infrastructure"] }); rel(key, "located_in", `country:${country}`); }
for (const [slug, name, country, lat, lon, , serves] of utilities) {
  E.push({ key: `desal:${slug}`, type: "desalination", name: `${name} desalination plant`, country, lat, lon, domains: ["infrastructure"] });
  E.push({ key: `power:${slug}`, type: "power_plant", name: `${name} power plant`, country, lat: lat + 0.01, lon: lon + 0.01, domains: ["infrastructure"] });
  rel(`desal:${slug}`, "located_in", `country:${country}`); rel(`power:${slug}`, "located_in", `country:${country}`);
  rel(`desal:${slug}`, "depends_on", `power:${slug}`, 0.9, "Co-located plant supplies electricity for desalination");
  for (const c of serves) rel(c, "depends_on", `desal:${slug}`, 0.7, "Drinking-water supply");
}
E.push({ key: "power:barakah", type: "power_plant", name: "Barakah nuclear power plant", country: "ARE", lat: 23.96, lon: 52.26, domains: ["infrastructure"] });
rel("power:barakah", "located_in", "country:ARE"); rel("city:abu-dhabi", "depends_on", "power:barakah", 0.5);
// Gas-fired power depends on gas supply
for (const p of ["power:taweelah", "power:jebel-ali", "power:fujairah", "power:mirfa"]) rel(p, "depends_on", "pipeline:dolphin", 0.6, "Gas feed for power generation");

add("airport", ["supply_chain", "infrastructure"], [
  ["airport:ruh", "King Khalid International Airport", "SAU", 24.96, 46.7], ["airport:jed", "King Abdulaziz International Airport", "SAU", 21.68, 39.16],
  ["airport:dmm", "King Fahd International Airport", "SAU", 26.47, 49.8], ["airport:dxb", "Dubai International Airport", "ARE", 25.25, 55.36],
  ["airport:dwc", "Al Maktoum International Airport", "ARE", 24.9, 55.16], ["airport:auh", "Zayed International Airport", "ARE", 24.43, 54.65],
  ["airport:doh", "Hamad International Airport", "QAT", 25.27, 51.61], ["airport:kwi", "Kuwait International Airport", "KWT", 29.24, 47.97],
  ["airport:mct", "Muscat International Airport", "OMN", 23.59, 58.28], ["airport:bah", "Bahrain International Airport", "BHR", 26.27, 50.63],
]);
for (const [a, c, city] of [["airport:ruh", "SAU", "city:riyadh"], ["airport:jed", "SAU", "city:jeddah"], ["airport:dmm", "SAU", "city:dammam"], ["airport:dxb", "ARE", "city:dubai"], ["airport:dwc", "ARE", "city:dubai"], ["airport:auh", "ARE", "city:abu-dhabi"], ["airport:doh", "QAT", "city:doha"], ["airport:kwi", "KWT", "city:kuwait-city"], ["airport:mct", "OMN", "city:muscat"], ["airport:bah", "BHR", "city:manama"]] as const) {
  rel(a, "located_in", `country:${c}`); rel(city, "depends_on", a, 0.3, "Air cargo and passenger access");
}
// Aviation fuel from refineries
rel("airport:dxb", "depends_on", "refinery:jebel-ali", 0.4); rel("airport:jed", "depends_on", "refinery:rabigh", 0.4); rel("airport:doh", "depends_on", "refinery:laffan", 0.4);

// Food and goods: cities depend on their main import port
for (const [city, port] of [["city:riyadh", "port:dammam"], ["city:jeddah", "port:jeddah"], ["city:dammam", "port:dammam"], ["city:dubai", "port:jebel-ali"], ["city:abu-dhabi", "port:khalifa"], ["city:doha", "port:hamad"], ["city:kuwait-city", "port:shuwaikh"], ["city:muscat", "port:sohar"], ["city:manama", "port:khalifa-bin-salman"], ["city:sharjah", "port:sharjah"]] as const) {
  rel(city, "imports_food_via", port, 0.7, "Main import gateway for food and goods");
}
for (const c of GCC) rel(`country:${c}`, "imports", "commodity:grain", 0.8);

// Routes beyond the strait
rel("chokepoint:hormuz", "leads_to", "route:gulf-of-oman", 1); rel("route:gulf-of-oman", "leads_to", "route:arabian-sea", 1);
rel("route:arabian-sea", "leads_to", "chokepoint:malacca", 0.8); rel("route:arabian-sea", "leads_to", "chokepoint:bab-el-mandeb", 0.3);
rel("chokepoint:malacca", "leads_to", "market:china", 0.5); rel("chokepoint:malacca", "leads_to", "market:japan", 0.2); rel("chokepoint:malacca", "leads_to", "market:korea", 0.2);
rel("route:arabian-sea", "leads_to", "market:india", 0.3);
rel("route:red-sea", "leads_to", "chokepoint:suez", 0.7); rel("route:red-sea", "leads_to", "chokepoint:bab-el-mandeb", 0.5);
rel("chokepoint:bab-el-mandeb", "leads_to", "route:red-sea", 0.9); rel("chokepoint:suez", "leads_to", "market:europe", 0.8);
rel("route:cape", "alternative_to", "chokepoint:suez", 0.6, "Longer route used when the Red Sea is avoided"); rel("route:cape", "leads_to", "market:europe", 0.4);
rel("route:persian-gulf", "leads_to", "chokepoint:hormuz", 1); rel("market:usa", "imports_via", "chokepoint:hormuz", 0.1);
rel("commodity:crude", "transits", "chokepoint:hormuz", 0.9); rel("commodity:lng", "transits", "chokepoint:hormuz", 0.9);

export const REFERENCE = { version: "gcc-reference-2026-11-06", note: "Curated demonstration reference. Real place names, approximate coordinates, no operators named. Capacities are rounded and illustrative until validated against the institution's GIS and asset registry.", entities: E, relationships: R };
