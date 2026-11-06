/**
 * Public source catalogue seeded into each institution's registry (DS §2–5, FR-06, TR-014).
 * Each institution holds its own copy: approvals, owners and status are per institution.
 * Status reflects the collection attempt recorded on 6 Nov 2026; it is not assumed.
 */
export interface CatalogSource {
  key: string;
  name: string;
  publisher: string;
  sourceClass: "public" | "third_party_derived" | "illustrative";
  country: string | null;
  accessMethod: "api" | "file_download" | "web_page" | "upload";
  url: string;
  licence: string;
  ownerRole: "analyst" | "administrator" | "domain_expert";
  purposes: string[];
  cadence: string;
  freshnessLimitHours: number;
  status: "approved" | "pending_review" | "unreachable";
  statusNote?: string;
}

const MACRO = ["macro_context", "scenario_baseline", "back_testing"];

export const SOURCE_CATALOG: CatalogSource[] = [
  { key: "worldbank.wdi", name: "World Development Indicators", publisher: "World Bank", sourceClass: "public", country: null, accessMethod: "api", url: "https://api.worldbank.org/v2/", licence: "CC BY 4.0", ownerRole: "analyst", purposes: MACRO, cadence: "Annual, refreshed quarterly", freshnessLimitHours: 24 * 120, status: "approved" },
  { key: "imf.weo", name: "World Economic Outlook (DataMapper)", publisher: "International Monetary Fund", sourceClass: "public", country: null, accessMethod: "api", url: "https://www.imf.org/external/datamapper/api/v1/", licence: "IMF Copyright and Usage", ownerRole: "analyst", purposes: MACRO, cadence: "Twice a year (April, October)", freshnessLimitHours: 24 * 200, status: "approved" },
  { key: "jodi.oil", name: "JODI Oil World Database", publisher: "Joint Organisations Data Initiative", sourceClass: "public", country: null, accessMethod: "file_download", url: "https://www.jodidata.org/oil/database/data-downloads.aspx", licence: "Free use with attribution", ownerRole: "domain_expert", purposes: ["energy_supply", "scenario_baseline", "back_testing"], cadence: "Monthly", freshnessLimitHours: 24 * 45, status: "approved" },
  { key: "eia.chokepoints", name: "World oil transit chokepoints analysis", publisher: "U.S. Energy Information Administration", sourceClass: "public", country: null, accessMethod: "web_page", url: "https://www.eia.gov/todayinenergy/detail.php?id=65504", licence: "Public domain", ownerRole: "domain_expert", purposes: ["energy_supply", "maritime_context", "scenario_baseline"], cadence: "Irregular analysis", freshnessLimitHours: 24 * 400, status: "approved" },
  { key: "ofac.sdn", name: "Specially Designated Nationals list (vessels)", publisher: "U.S. Treasury OFAC", sourceClass: "public", country: null, accessMethod: "file_download", url: "https://sanctionslistservice.ofac.treas.gov/", licence: "Public domain", ownerRole: "analyst", purposes: ["sanctions_screening", "maritime_context"], cadence: "As published, often weekly", freshnessLimitHours: 24 * 7, status: "approved" },
  { key: "uk.sanctions", name: "UK Sanctions List (ships)", publisher: "UK Foreign, Commonwealth & Development Office", sourceClass: "public", country: null, accessMethod: "file_download", url: "https://sanctionslist.fcdo.gov.uk/", licence: "Open Government Licence v3.0", ownerRole: "analyst", purposes: ["sanctions_screening", "maritime_context"], cadence: "As published", freshnessLimitHours: 24 * 7, status: "approved" },
  { key: "gccstat.portal", name: "GCC-Stat data portal", publisher: "GCC Statistical Center", sourceClass: "public", country: null, accessMethod: "web_page", url: "https://dp.marsa.gccstat.org/en", licence: "To confirm with publisher", ownerRole: "analyst", purposes: MACRO, cadence: "Varies by series", freshnessLimitHours: 24 * 120, status: "unreachable", statusNote: "Portal returned HTTP 429 (rate limited) on 6 Nov 2026. Series selection and terms still to confirm." },
  { key: "datasaudi.portal", name: "DataSaudi", publisher: "Ministry of Economy and Planning, Saudi Arabia", sourceClass: "public", country: "Saudi Arabia", accessMethod: "web_page", url: "https://datasaudi.sa/en", licence: "Saudi Open Data Licence (to confirm per dataset)", ownerRole: "analyst", purposes: MACRO, cadence: "Varies by series", freshnessLimitHours: 24 * 120, status: "pending_review", statusNote: "Reachable. No machine-readable series selected yet; underlying agency must be recorded per dataset (TR-014)." },
  { key: "gastat.portal", name: "General Authority for Statistics", publisher: "GASTAT, Saudi Arabia", sourceClass: "public", country: "Saudi Arabia", accessMethod: "web_page", url: "https://www.stats.gov.sa/en", licence: "To confirm per dataset", ownerRole: "analyst", purposes: MACRO, cadence: "Varies by series", freshnessLimitHours: 24 * 120, status: "pending_review", statusNote: "Reachable. Dataset selection pending." },
  { key: "bayanat.portal", name: "Bayanat", publisher: "UAE Federal Competitiveness and Statistics Centre", sourceClass: "public", country: "United Arab Emirates", accessMethod: "web_page", url: "https://bayanat.ae/en", licence: "To confirm per dataset", ownerRole: "analyst", purposes: MACRO, cadence: "Varies by series", freshnessLimitHours: 24 * 120, status: "pending_review", statusNote: "Reachable. Dataset selection pending." },
  { key: "sama.statistics", name: "SAMA monthly statistics", publisher: "Saudi Central Bank", sourceClass: "public", country: "Saudi Arabia", accessMethod: "web_page", url: "https://www.sama.gov.sa/", licence: "To confirm", ownerRole: "analyst", purposes: ["macro_context", "banking_context"], cadence: "Monthly", freshnessLimitHours: 24 * 45, status: "unreachable", statusNote: "Statistics page returned HTTP 404 on 6 Nov 2026; new location to confirm." },
  { key: "cbuae.statistics", name: "CBUAE statistics", publisher: "Central Bank of the UAE", sourceClass: "public", country: "United Arab Emirates", accessMethod: "web_page", url: "https://www.centralbank.ae/", licence: "To confirm", ownerRole: "analyst", purposes: ["macro_context", "banking_context"], cadence: "Monthly", freshnessLimitHours: 24 * 45, status: "unreachable", statusNote: "No response from this network on 6 Nov 2026." },
  { key: "un.sanctions", name: "UN Security Council Consolidated List", publisher: "United Nations", sourceClass: "public", country: null, accessMethod: "file_download", url: "https://scsanctions.un.org/", licence: "UN terms", ownerRole: "analyst", purposes: ["sanctions_screening"], cadence: "As published", freshnessLimitHours: 24 * 7, status: "unreachable", statusNote: "No response from this network on 6 Nov 2026." },
  { key: "upload.documents", name: "Documents added by analysts", publisher: "Uploaded inside the institution", sourceClass: "illustrative", country: null, accessMethod: "upload", url: "", licence: "As stated in each document", ownerRole: "analyst", purposes: ["case_evidence"], cadence: "On demand", freshnessLimitHours: 24 * 30, status: "approved", statusNote: "Every upload passes the same validation, including the injection screen." },
];

/** Purpose each package source is imported under. Must be in the source's allowed purposes. */
export const IMPORT_PURPOSE: Record<string, string> = {
  "worldbank.wdi": "macro_context", "imf.weo": "macro_context", "jodi.oil": "energy_supply", "eia.chokepoints": "energy_supply",
  "ofac.sdn": "sanctions_screening", "uk.sanctions": "sanctions_screening", "upload.documents": "case_evidence",
};
