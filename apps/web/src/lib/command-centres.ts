/**
 * Sector Command Centres (Command Centres brief): eight sector screens driven by ONE config object and block
 * renderers, so adding a sector is data, not code. Hard rule: no numbers. Every metric is "—" with "Source not
 * connected", every chart an empty state, every specialist "Awaiting data", every mandate item "Approval required".
 * Copy is the brief's, verbatim. Images are illustrative crops of the supplied mockups.
 */
export type Pill = "awaiting" | "approval" | "high" | "medium" | "low" | { text: string };
export interface Item { title: string; desc?: string; icon?: string; pill?: Pill; button?: string; dot?: "high" | "medium" | "low" }
interface Base { span: number; title?: string; icon?: string; subtitle?: string; link?: string; chip?: boolean; more?: boolean; stack?: Block }
export type Block =
  | (Base & { type: "kpis"; items: Item[] })
  | (Base & { type: "map"; img: string; ratio: number; alt: string; segmented?: string[]; dropdown?: { label?: string; options: string[] }[]; legend?: Item[]; legendSide?: "left" | "right"; chips?: Item[]; expand?: boolean; button?: string; dark?: boolean; sideList?: Item[] })
  | (Base & { type: "glance"; items: Item[] })
  | (Base & { type: "rows"; items: Item[] })
  | (Base & { type: "chart"; x: string[]; y?: string; yTicks?: string[]; empty: [string, string]; button?: string; tabs?: string[]; dropdown?: string[] })
  | (Base & { type: "list"; items: Item[]; footerButton?: string; dropdown?: string })
  | (Base & { type: "tiles"; items: Item[] })
  | (Base & { type: "table"; columns: string[]; rows?: string[][] })
  | (Base & { type: "empty"; tabs?: string[]; filters?: string[]; empty?: [string, string]; button?: string })
  | (Base & { type: "align"; items: Item[]; button?: string; pillButton?: string })
  | (Base & { type: "kv"; items: Array<{ label: string; value: string; icon: string }> })
  | (Base & { type: "actions"; items: Item[] })
  | (Base & { type: "status"; items: Item[]; button?: string })
  | (Base & { type: "pair"; blocks: Block[] });

export interface Sector {
  key: string; industry: string; label: string; icon: string;
  eyebrow?: string; eyebrowCaps?: boolean; badge?: boolean;
  title: string; subtitle: string;
  right: { hero?: string; heroAlt?: string; meta?: string; metaTabs?: Item[] };
  pageTabs?: string[]; approvals: number; search?: boolean; side: string;
  rows: Block[][]; footer: string[]; footerRight: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AW: Pill = "awaiting", AP: Pill = "approval";
const FOOT = ["Last updated: —", "Source: Not connected", "Evidence: Not available"];
const CAD = "Connect authorised data";

export const INSTITUTIONS = ["Sovereign Wealth Fund", "Government Ministry or Authority", "National Development or Economic Planning Authority", "Regulatory Authority", "Central Bank or Monetary Authority", "Strategic Infrastructure Entity"];
export const NAV = [
  { label: "Sovereign Overview", icon: "house" }, { label: "Sector Intelligence", icon: "chart-no-axes-column" }, { label: "AI Command", icon: "brain" },
  { label: "Foresight & Scenarios", icon: "binoculars" }, { label: "Mandates & Authority", icon: "file-text" }, { label: "Decisions & Approvals", icon: "square-check" },
  { label: "Governed Execution", icon: "settings" }, { label: "Institutional Memory", icon: "database" }, { label: "Data & Integrations", icon: "network" },
];

export const SECTORS: Sector[] = [
  {
    key: "supply-chain", industry: "supply_chain", label: "Supply Chain & Logistics", icon: "truck", eyebrow: "Proposed interface",
    title: "Supply Chain & Logistics Command Centre", subtitle: "End-to-end visibility. Resilient networks. Smarter, more secure supply chains.",
    right: { meta: "Last updated: — · Source not connected", metaTabs: [{ title: "Shipments", icon: "ship" }, { title: "Ports & Terminals", icon: "landmark" }, { title: "Land Routes", icon: "truck" }, { title: "Air Cargo", icon: "plane" }, { title: "Warehouses", icon: "warehouse" }, { title: "Distribution", icon: "package" }] },
    approvals: 2, side: "/command/supply-side.webp", footer: FOOT, footerRight: "TIGERIS AI OS · Supply Chain & Logistics",
    rows: [
      [
        { type: "map", span: 8, title: "Supply Chain Network", subtitle: "Ports, routes, warehouses and key corridors", segmented: ["Network", "Ports", "Routes", "Warehouses"], expand: true, img: "/command/supply-map.webp", ratio: 813 / 365, alt: "Illustrative map of ports, sea, land and air routes, warehouses and key corridors" },
        { type: "glance", span: 4, title: "Network Overview", link: "View details", items: [{ title: "Total Shipments (Period)", icon: "ship" }, { title: "On-time Delivery (Commitments)", icon: "clock" }, { title: "Active Routes", icon: "route" }, { title: "Warehouse Capacity Usage", icon: "warehouse" }],
          stack: { type: "chart", span: 4, title: "Delivery Commitments", link: "View all", x: MONTHS, yTicks: ["100%", "75%", "50%", "25%", "0%"], empty: [CAD, "Delivery performance will appear here once data is connected."] } },
      ],
      [
        { type: "list", span: 4, title: "Priority Intelligence Cases", link: "View all", items: [
          { title: "Port Congestion Risk", desc: "Assess congestion risk across key ports and expected impact on downstream deliveries.", icon: "anchor" },
          { title: "Route Resilience Analysis", desc: "Evaluate alternative land and sea routes for critical corridors under disruption scenarios.", icon: "route" },
          { title: "Strategic Warehouse Positioning", desc: "Analyse optimal warehouse locations to improve resilience and service levels.", icon: "warehouse" },
          { title: "Critical Goods Flow Monitoring", desc: "Identify risks to critical and strategic goods supply chains.", icon: "triangle-alert" }] },
        { type: "list", span: 4, title: "AI Specialist Activity", link: "View all", items: [
          { title: "Supply Chain Analyst", desc: "Monitors global supply chain developments and identifies emerging risks.", icon: "user", pill: AW },
          { title: "Logistics Optimiser", desc: "Analyses routing and distribution options to improve resilience and efficiency.", icon: "box", pill: AW },
          { title: "Port Operations Analyst", desc: "Assesses port operations, congestion risk and turnaround efficiency.", icon: "anchor", pill: AW },
          { title: "Demand & Supply Modeller", desc: "Models demand scenarios and supply availability across key goods.", icon: "warehouse", pill: AW }] },
        { type: "list", span: 4, title: "Expert Review Queue", link: "View all", items: [
          { title: "Alternative routing options for disrupted corridor", icon: "truck", pill: AW }, { title: "Warehouse capacity expansion options", icon: "box", pill: AW },
          { title: "Supply risk assessment for critical goods", icon: "package-search", pill: AW }, { title: "Port congestion mitigation measures", icon: "package", pill: AW }] },
      ],
      [
        { type: "tiles", span: 8, title: "Scenario Analysis", subtitle: "Launch a scenario to explore supply chain and logistics options.", link: "View all", items: [
          { title: "Port Disruption Scenario", desc: "Test impact of port disruption and evaluate alternative routes.", icon: "anchor" },
          { title: "Route Diversion Scenario", desc: "Assess land and sea route alternatives under disruption.", icon: "route" },
          { title: "Demand Surge Scenario", desc: "Model impact of sudden demand increase on supply chain.", icon: "chart-no-axes-column" }] },
        { type: "list", span: 4, title: "Mandates & Decisions", link: "View all", items: [
          { title: "Policy alignment check", desc: "Check alignment with national supply chain and trade policies.", icon: "scale", pill: AP },
          { title: "Decision recommendation", desc: "Review AI analysis and approve recommended action.", icon: "file-check", pill: AP }] },
      ],
    ],
  },
  {
    key: "real-estate", industry: "construction_real_estate", label: "Real Estate & Construction", icon: "building-2", eyebrow: "Real Estate & Construction", eyebrowCaps: true,
    title: "Real Estate & Construction Command Centre", subtitle: "Unified intelligence for planning, delivery and sustainable urban growth",
    right: { hero: "/command/realestate-hero.webp", heroAlt: "Illustrative skyline with towers under construction" },
    approvals: 1, side: "/command/realestate-side.webp", footer: ["Last updated: —", "Source: Not connected", "All data requires authorised institutional sources"], footerRight: "TIGERIS AI OS · Real Estate & Construction",
    rows: [
      [{ type: "kpis", span: 12, items: [{ title: "Total Projects", icon: "building" }, { title: "Projects in Delivery", icon: "construction" }, { title: "Financing Exposure", icon: "coins" }, { title: "Expected Occupancy", icon: "users" }, { title: "Delivery Risk (Weighted)", icon: "triangle-alert" }] }],
      [
        { type: "map", span: 8, title: "Asset Map & Project Portfolio", icon: "map", dropdown: [{ label: "View:", options: ["Projects", "Assets", "Contractors"] }], img: "/command/realestate-map.webp", ratio: 678 / 255, alt: "Illustrative waterfront development with projects marked by status", legendSide: "left",
          legend: [{ title: "All Projects", icon: "layout-grid" }, { title: "Residential", icon: "building" }, { title: "Mixed Use", icon: "building-2" }, { title: "Commercial", icon: "store" }, { title: "Infrastructure", icon: "construction" }, { title: "Hospitality", icon: "hotel" }, { title: "Mega Projects", icon: "landmark" }],
          chips: [{ title: "Planned", dot: "low" }, { title: "In Delivery", dot: "medium" }, { title: "Completed" }] },
        { type: "chart", span: 4, title: "Project Milestones", icon: "chart-no-axes-column", more: true, y: "Projects", yTicks: ["50", "40", "30", "20", "10", "0"], x: ["Planning", "Design", "Approvals", "Construction", "Handover"], empty: [CAD, "Project milestone data will be displayed here once a data source is connected."],
          stack: { type: "chart", span: 4, title: "Contractor Dependencies", icon: "link", more: true, y: "Number of Contractors", yTicks: ["40", "30", "20", "10", "0"], x: ["Tier 1", "Tier 2", "Tier 3", "Specialist"], empty: [CAD, "Contractor dependency data will be displayed here once a data source is connected."] } },
      ],
      [
        { type: "list", span: 4, title: "Priority Intelligence Cases", icon: "lightbulb", link: "View all", items: [
          { title: "Urban expansion readiness", desc: "Assess infrastructure, utilities and land readiness for planned developments.", icon: "building" },
          { title: "Project delivery risk signals", desc: "Identify early indicators of delay across key projects.", icon: "construction" },
          { title: "Construction cost pressures", desc: "Analyse cost drivers and market conditions affecting delivery.", icon: "coins" },
          { title: "Land use and zoning optimisation", desc: "Evaluate land allocation scenarios for maximum impact.", icon: "map" }] },
        { type: "list", span: 4, title: "AI Specialist Activity", icon: "network", link: "View all", items: [
          { title: "Construction Monitor", desc: "Tracks project delivery, contractors and site progress.", icon: "construction", pill: AW },
          { title: "Market Analyst", desc: "Analyses real estate market dynamics and demand signals.", icon: "chart-no-axes-column", pill: AW },
          { title: "Cost Intelligence Specialist", desc: "Monitors construction costs and supply chain risks.", icon: "coins", pill: AW },
          { title: "Sustainability & ESG Analyst", desc: "Assesses environmental impact and sustainability compliance.", icon: "leaf", pill: AW }] },
        { type: "chart", span: 4, title: "Financing Exposure", icon: "coins", more: true, y: "Exposure", yTicks: ["", "", "", "", "0"], x: ["Planning", "Design", "Construction", "Handover"], empty: [CAD, "Financing exposure data will be displayed here once a data source is connected."] },
      ],
      [
        { type: "table", span: 4, title: "Expert Review Queue", icon: "users", link: "View all", columns: ["Case", "Type", "Expert domain", "Status"] },
        { type: "list", span: 4, title: "Scenario Launch", icon: "workflow", link: "View all", items: [
          { title: "Urban Growth Scenario", desc: "Model demand, infrastructure and delivery phasing.", icon: "building", button: "Launch" },
          { title: "Construction Cost Scenario", desc: "Assess cost change impacts on delivery timelines.", icon: "landmark", button: "Launch" }] },
        { type: "empty", span: 4, title: "Mandate Checks & Decisions", icon: "file-text", link: "View all", tabs: ["Pending", "Approved", "Requires Information", "Rejected"] },
      ],
    ],
  },
  {
    key: "manufacturing", industry: "manufacturing", label: "Manufacturing", icon: "factory", eyebrow: "TIGERIS AI OS — Manufacturing", eyebrowCaps: true,
    title: "Manufacturing Command Centre", subtitle: "Production resilience, supply security and industrial competitiveness.",
    right: { meta: "Proposed interface · Last updated: — · Source not connected" }, approvals: 1, side: "/command/manufacturing-side.webp", footer: FOOT, footerRight: "TIGERIS AI OS · Manufacturing",
    rows: [
      [
        { type: "map", span: 8, title: "Manufacturing Asset Map", icon: "layers", segmented: ["Map view", "List view"], dropdown: [{ options: ["All facilities"] }, { options: ["All product types"] }], expand: true, img: "/command/manufacturing-map.webp", ratio: 663 / 269, alt: "Illustrative industrial estate with production facilities, storage and logistics", legendSide: "left",
          legend: [{ title: "Production facility", icon: "factory" }, { title: "Materials input", icon: "triangle" }, { title: "Logistics node", icon: "truck" }, { title: "Storage / inventory", icon: "database" }, { title: "Utilities", icon: "droplet" }, { title: "Key supplier link", icon: "link" }] },
        { type: "glance", span: 4, title: "Sector at a Glance", icon: "chart-no-axes-column", chip: true, items: [{ title: "Production capacity", icon: "factory" }, { title: "Critical materials", icon: "triangle-alert" }, { title: "Supplier concentration", icon: "users" }, { title: "Inventory buffers", icon: "database" }, { title: "Equipment downtime", icon: "wrench" }] },
      ],
      [
        { type: "tiles", span: 8, title: "Key Manufacturing Intelligence Areas", icon: "target", items: [
          { title: "Production Capacity Analysis", desc: "Assess capacity, utilisation and expansion options", icon: "factory" },
          { title: "Critical Materials Security", desc: "Track key inputs and supply risk exposure", icon: "triangle" },
          { title: "Supplier Concentration", desc: "Identify dependency risks across supplier tiers", icon: "network" },
          { title: "Inventory Resilience", desc: "Evaluate buffer levels and stock-out risk", icon: "database" },
          { title: "Equipment Reliability", desc: "Analyse downtime risk and maintenance needs", icon: "wrench" }] },
        { type: "chart", span: 4, title: "Production & Capacity Trend", icon: "chart-line", chip: true, y: "Production output (index)", yTicks: ["100", "75", "50", "25", "0"], x: MONTHS, empty: [CAD, "View production output, capacity and utilisation over time."], button: CAD },
      ],
      [
        { type: "list", span: 3, title: "AI Specialist Activity", icon: "network", chip: true, items: [
          { title: "Industrial Operations Analyst", desc: "Monitors production, capacity and equipment performance", icon: "factory", pill: AW },
          { title: "Supply Chain Risk Analyst", desc: "Assesses supplier concentration and material supply risks", icon: "target", pill: AW },
          { title: "Materials Intelligence Analyst", desc: "Tracks critical materials and alternative supply options", icon: "triangle", pill: AW },
          { title: "Industrial Decarbonisation Analyst", desc: "Analyses energy use, emissions and transition pathways", icon: "leaf", pill: AW }] },
        { type: "list", span: 3, title: "Priority Intelligence Cases", icon: "file-text", chip: true, items: [
          { title: "Critical material supply risk assessment", desc: "Evaluate exposure and mitigation options", dot: "high", pill: "high" },
          { title: "Production capacity expansion options", desc: "Assess feasibility and requirements", dot: "high", pill: "high" },
          { title: "Supplier concentration analysis", desc: "Identify single-source and high-risk suppliers", dot: "medium", pill: "medium" },
          { title: "Inventory buffer adequacy", desc: "Stress test buffer levels under disruption scenarios", dot: "medium", pill: "medium" },
          { title: "Equipment downtime risk analysis", desc: "Identify critical assets and maintenance needs", dot: "low", pill: "low" }] },
        { type: "list", span: 3, title: "Scenario Launch", icon: "play", chip: true, footerButton: "Launch scenario analysis", items: [
          { title: "Supply disruption scenario", desc: "Model impact of material supply shocks", icon: "package-x" },
          { title: "Demand surge scenario", desc: "Assess capacity response options", icon: "bell" },
          { title: "Energy price shock scenario", desc: "Evaluate cost and operating impact", icon: "flame" },
          { title: "Geopolitical risk scenario", desc: "Analyse trade, export and import constraints", icon: "chart-line" }] },
        { type: "list", span: 3, title: "Expert Review Queue", icon: "user-round", chip: true, items: [
          { title: "Review supplier risk assessment", desc: "Awaiting expert input", dot: "high", pill: "high" },
          { title: "Validate capacity expansion options", desc: "Technical review required", dot: "medium", pill: "medium" },
          { title: "Assess material substitution options", desc: "Specialist review required", dot: "medium", pill: "medium" }],
          stack: { type: "list", span: 3, title: "Mandates & Decisions", icon: "shield", chip: true, items: [
            { title: "Policy alignment check", desc: "Review alignment with industrial mandates", icon: "target" },
            { title: "Decision required", desc: "Approval needed for scenario analysis", icon: "circle-check", pill: AP }] } },
      ],
    ],
  },
  {
    key: "infrastructure", industry: "infrastructure", label: "Infrastructure & Utilities", icon: "zap", eyebrow: "TIGERIS AI OS", eyebrowCaps: true,
    title: "Infrastructure & Utilities Command Centre", subtitle: "Resilient infrastructure. Reliable services. A more secure and prosperous nation.",
    right: { hero: "/command/infra-hero.webp", heroAlt: "Illustrative skyline with a water treatment and power corridor" },
    pageTabs: ["Overview", "Critical Assets", "Network Dependencies", "Service Continuity", "Capacity Planning", "Outage Response"],
    approvals: 1, side: "/command/infra-side.webp", footer: FOOT, footerRight: "TIGERIS AI OS · Infrastructure & Utilities",
    rows: [
      [
        { type: "map", span: 8, title: "National Infrastructure Asset Map", icon: "map", dropdown: [{ label: "View by", options: ["Asset Type", "Region", "Criticality"] }], img: "/command/infra-map.webp", ratio: 566 / 316, alt: "Illustrative national map of power, water and pipeline infrastructure",
          sideList: [{ title: "Power Generation", icon: "zap" }, { title: "Transmission Networks", icon: "radio-tower" }, { title: "Water Production & Treatment", icon: "droplet" }, { title: "Water Transmission", icon: "waves" }, { title: "Oil & Gas Pipelines", icon: "fuel" }, { title: "Key Service Facilities", icon: "building" }] },
        { type: "glance", span: 4, title: "Sector at a Glance", icon: "chart-no-axes-column", chip: true, items: [{ title: "Critical Assets", icon: "landmark" }, { title: "Network Dependencies", icon: "network" }, { title: "Service Continuity", icon: "settings" }, { title: "Planned Capacity Additions", icon: "chart-no-axes-column" }],
          stack: { type: "chart", span: 4, title: "Service Continuity Trend", icon: "chart-line", chip: true, yTicks: ["100", "75", "50", "25", "0"], x: MONTHS, empty: [CAD, "View service continuity performance over time."] } },
      ],
      [
        { type: "list", span: 4, title: "Priority Intelligence Cases", icon: "lightbulb", link: "See all", items: [
          { title: "Grid resilience ahead of peak demand period", desc: "Demand, supply margins and network constraints", icon: "zap", pill: AW },
          { title: "Water security and treatment capacity outlook", desc: "Supply resilience and infrastructure constraints", icon: "droplet", pill: AW },
          { title: "Critical pipeline corridor risk assessment", desc: "Physical and cyber risk signals", icon: "fuel", pill: AW },
          { title: "Key infrastructure asset health and lifecycle", desc: "Ageing assets and renewal priorities", icon: "chart-no-axes-column", pill: AW }] },
        { type: "list", span: 4, title: "AI Specialist Activity", icon: "brain", link: "See all", items: [
          { title: "Infrastructure Analyst", desc: "Monitors asset performance, demand and risk", icon: "chart-line", pill: AW },
          { title: "Network Modelling Specialist", desc: "Analyses interdependencies across power, water and fuel", icon: "network", pill: AW },
          { title: "Outage Risk Analyst", desc: "Detects emerging service disruption risk", icon: "triangle-alert", pill: AW },
          { title: "Capacity Planning Specialist", desc: "Assesses future capacity and investment scenarios", icon: "chart-no-axes-column", pill: AW }] },
        { type: "list", span: 4, title: "Expert Review Queue", icon: "users", link: "See all", items: [
          { title: "Review: Transmission network risk assessment", desc: "Technical analysis and assumptions", icon: "file-text", pill: AW },
          { title: "Review: Water treatment capacity options", desc: "Scenario outputs and implications", icon: "file-text", pill: AW },
          { title: "Review: Pipeline corridor security assessment", desc: "Risk areas and mitigation options", icon: "file-text", pill: AW },
          { title: "Review: Infrastructure investment prioritisation", desc: "Options and recommended approach", icon: "file-text", pill: AW }] },
      ],
      [
        { type: "tiles", span: 4, title: "Scenario Analysis", icon: "shuffle", subtitle: "Launch a sector scenario to assess impacts and trade-offs.", items: [
          { title: "Demand Surge", desc: "Test high demand conditions", icon: "chart-no-axes-column" }, { title: "Supply Disruption", desc: "Assess outage scenarios", icon: "triangle-alert" },
          { title: "Investment Options", desc: "Compare capacity pathways", icon: "coins" }, { title: "Climate Stress", desc: "Model climate-related risks", icon: "leaf" }] },
        { type: "actions", span: 4, title: "Mandate Checks & Decisions", icon: "shield-check", link: "See all", items: [
          { title: "Policy / mandate alignment check", desc: "Against relevant mandates and authority", icon: "file-text", button: "Run Check" },
          { title: "Submit for decision", desc: "Prepare briefing and route for approval", icon: "file-text", button: "Create Submission" }] },
        { type: "kv", span: 4, title: "Data & Evidence", icon: "database", chip: true, items: [
          { label: "Authoritative data sources", value: "Not connected", icon: "landmark" }, { label: "Latest evidence pack", value: "Not available", icon: "file-text" }, { label: "Last updated", value: "—", icon: "clock" }] },
      ],
    ],
  },
  {
    key: "sovereign-capital", industry: "sovereign_capital", label: "Sovereign Capital & Treasury", icon: "landmark", eyebrow: "Proposed interface",
    title: "Sovereign Capital & Treasury Command Centre", subtitle: "Align national mandate, capital allocation and treasury operations for long-term, sustainable value.",
    right: { hero: "/command/capital-hero.webp", heroAlt: "Illustrative skyline with the words Capital for a stronger tomorrow" },
    approvals: 1, side: "/command/capital-side.webp", footer: FOOT, footerRight: "TIGERIS AI OS · Sovereign Capital & Treasury",
    rows: [
      [
        { type: "align", span: 4, title: "National Mandate Alignment", icon: "target", subtitle: "Track how capital and treasury activity supports national priorities and strategic outcomes.", pillButton: "Explore mandate alignment", items: [
          { title: "Economic diversification", icon: "chart-pie" }, { title: "Strategic sectors", icon: "factory" }, { title: "Global partnerships", icon: "handshake" }, { title: "Sustainable growth", icon: "chart-no-axes-column" }, { title: "Intergenerational value", icon: "hourglass" }] },
        { type: "map", span: 4, title: "Sovereign Asset Map", icon: "sun", subtitle: "Illustrative view of sovereign capital across asset classes, sectors and geographies.", segmented: ["Map", "Sectors", "Regions"], img: "/command/capital-map.webp", ratio: 580 / 259, alt: "Illustrative map of sovereign capital across asset classes, sectors and geographies", dark: true },
        { type: "chart", span: 4, title: "Holdings, Commitments & Cash Flows", icon: "database", tabs: ["Holdings", "Commitments", "Liabilities", "Cash Flows"], y: "Asset Value by Class", yTicks: ["100", "75", "50", "25", "0"], x: ["Public Equity", "Private Equity", "Real Assets", "Credit", "Other"], empty: [CAD, ""], button: "Connect data", chip: true },
      ],
      [
        { type: "chart", span: 4, title: "Cross-Asset Exposure", icon: "chart-pie", subtitle: "View exposure across asset classes, sectors and geographies.", tabs: ["Asset Class", "Sector", "Geography"], yTicks: ["100", "75", "50", "25", "0"], x: [], empty: [CAD, ""], button: "Connect data", chip: true },
        { type: "chart", span: 4, title: "Capital Allocation & Pipeline", icon: "git-fork", subtitle: "Track strategic allocation, pipeline and deployment activity.", tabs: ["Strategic Allocation", "Pipeline", "Deployment"], yTicks: ["100", "75", "50", "25", "0"], x: [], empty: [CAD, ""], button: "Connect data", chip: true },
        { type: "chart", span: 4, title: "Long-Horizon Scenarios", icon: "binoculars", subtitle: "Model the impact of global and domestic scenarios on the portfolio.", tabs: ["Portfolio Impact", "Liquidity", "Resilience"], yTicks: ["100", "75", "50", "25", "0"], x: [], empty: [CAD, ""], button: "Connect data", chip: true },
      ],
      [
        { type: "list", span: 3, title: "Priority Intelligence Cases", icon: "file-search", subtitle: "Key developments and analyses for sovereign capital and treasury.", items: [
          { title: "Global macro and capital market outlook", icon: "globe" }, { title: "Strategic sector investment opportunities", icon: "sprout" }, { title: "Sovereign fund activity and co-investment trends", icon: "chart-no-axes-column" },
          { title: "Treasury and liquidity risk monitoring", icon: "database" }, { title: "Regulatory and geopolitical developments", icon: "shield" }] },
        { type: "table", span: 3, title: "AI Specialist Activity", icon: "sparkles", subtitle: "Specialised AI analysts working on sovereign capital and treasury.", columns: ["Specialist", "Remit", "Status"], rows: [
          ["Macro Strategist", "Global macro analysis and market outlook", "Awaiting data"], ["Sovereign Investor Analyst", "Investment opportunities and portfolio analysis", "Awaiting data"],
          ["Treasury Risk Analyst", "Liquidity, funding and balance sheet risk", "Awaiting data"], ["Geopolitical Analyst", "Geopolitical risk and strategic implications", "Awaiting data"]] },
        { type: "empty", span: 3, title: "Expert Review Queue", icon: "users", subtitle: "Analyses and outputs awaiting expert review.", filters: ["All (0)", "Analysis (0)", "Scenarios (0)", "Decisions (0)"], empty: ["No items awaiting review", "New analyses and recommendations will appear here."] },
        { type: "list", span: 3, title: "Mandate Checks & Decisions", icon: "square-check", subtitle: "Assess mandate alignment and route for decision.", items: [
          { title: "Check mandate alignment", icon: "target" }, { title: "Run investment screening", icon: "file-text" }, { title: "Assess risk and constraints", icon: "shield" }, { title: "Prepare decision briefing", icon: "file-text" }, { title: "Submit for approval", icon: "arrow-right" }] },
      ],
    ],
  },
  {
    key: "energy", industry: "energy", label: "Energy & Oil", icon: "fuel", badge: true,
    title: "Energy & Oil Command Centre", subtitle: "Production. Infrastructure. Markets. Resilience. A more secure energy future.",
    right: { meta: "Last updated: — · Source: Not connected" }, approvals: 2, side: "/command/energy-side.webp", footer: ["Not connected to live data", "Source: Not connected", "Evidence: Not available"], footerRight: "TIGERIS AI OS · Energy & Oil",
    rows: [
      [
        { type: "map", span: 8, title: "Energy Assets & Infrastructure", icon: "fuel", subtitle: "Key production, processing and export infrastructure", button: "View asset list", img: "/command/energy-map.webp", ratio: 704 / 249, alt: "Illustrative map of production, pipelines and export terminals around the Gulf", legendSide: "left",
          legend: [{ title: "Production asset", icon: "mountain" }, { title: "Processing facility", icon: "factory" }, { title: "Pipeline (oil)", icon: "minus" }, { title: "Pipeline (gas)", icon: "ellipsis" }, { title: "Export terminal", icon: "ship" }, { title: "Strategic storage", icon: "database" }] },
        { type: "rows", span: 4, title: "Asset Overview", icon: "layers", items: [{ title: "Production assets", icon: "mountain" }, { title: "Pipeline network", icon: "git-commit-horizontal" }, { title: "Export terminals", icon: "ship" }, { title: "Strategic storage", icon: "database" }] },
      ],
      [
        { type: "chart", span: 4, title: "Production & Export Overview", icon: "database", more: true, y: "Volume", yTicks: ["100", "75", "50", "25", "0"], x: MONTHS, empty: [CAD, "No data available. Connect authorised data to view production trends and export volumes."] },
        { type: "map", span: 4, title: "Export Route Exposure", icon: "ship", expand: true, img: "/command/energy-route.webp", ratio: 373 / 141, alt: "Illustrative export route map with primary and alternative routes and a chokepoint", chips: [{ title: "Primary route", icon: "minus" }, { title: "Alternative route", icon: "ellipsis" }, { title: "Chokepoint", icon: "circle" }] },
        { type: "chart", span: 4, title: "Maintenance Intelligence", icon: "wrench", dropdown: ["Upcoming criticality", "Asset class", "Region"], y: "Asset count", yTicks: ["100", "75", "50", "25", "0"], x: MONTHS, empty: [CAD, "No data available. Connect authorised data to view maintenance outlook."] },
      ],
      [
        { type: "list", span: 4, title: "Priority Intelligence Cases", icon: "target", items: [
          { title: "Export route risk assessment", desc: "Assess potential disruptions across key maritime routes", icon: "shield" },
          { title: "Production resilience", desc: "Analyse operational resilience under different scenarios", icon: "factory" },
          { title: "Domestic energy demand outlook", desc: "Evaluate demand growth and infrastructure implications", icon: "chart-no-axes-column" },
          { title: "Global market dynamics", desc: "Monitor supply, demand and price drivers", icon: "refresh-cw" },
          { title: "Low carbon transition impact", desc: "Assess long-term implications for the sector", icon: "globe" }] },
        { type: "list", span: 4, title: "AI Specialist Activity", icon: "network", items: [
          { title: "Energy Markets Analyst", desc: "Monitors global oil and gas markets, supply-demand balances and price drivers.", icon: "chart-candlestick", pill: AW },
          { title: "Infrastructure Risk Analyst", desc: "Assesses pipeline, export route and asset disruption risks.", icon: "git-commit-horizontal", pill: AW },
          { title: "Maintenance Intelligence Specialist", desc: "Analyses asset health, maintenance schedules and risks.", icon: "wrench", pill: AW },
          { title: "Energy Transition Analyst", desc: "Evaluates transition scenarios and emissions implications for the energy sector.", icon: "leaf", pill: AW }] },
        { type: "list", span: 4, title: "Commodity Scenarios", icon: "chart-no-axes-column", items: [
          { title: "Oil price scenario analysis", desc: "Model market scenarios and fiscal implications", icon: "play" },
          { title: "Global supply disruption", desc: "Assess impact of supply shocks on markets and exports", icon: "play" },
          { title: "Energy transition pathways", desc: "Explore demand, investment and emissions scenarios", icon: "play" }],
          stack: { type: "pair", span: 4, blocks: [
            { type: "list", span: 6, title: "Energy Mandate Priorities", icon: "file-text", items: [{ title: "Energy security and supply resilience", icon: "square" }, { title: "Maximise value from hydrocarbons", icon: "square" }, { title: "Enable transition and lower emissions", icon: "square" }] },
            { type: "list", span: 6, title: "Decisions & Approvals", icon: "badge-check", items: [{ title: "Review scenario outputs", pill: AP }, { title: "Approve analysis for ministerial briefing", pill: AP }, { title: "Confirm mandate prioritisation", pill: AP }] }] } },
      ],
    ],
  },
  {
    key: "banking", industry: "banking", label: "Banking & Fintech", icon: "landmark", badge: true, search: true,
    title: "Banking & Fintech Command Centre", subtitle: "Liquidity. Stability. Innovation. A resilient and trusted financial ecosystem for a more prosperous Saudi Arabia.",
    right: { hero: "/command/banking-hero.webp", heroAlt: "Illustrative skyline of financial district towers" }, approvals: 1, side: "/command/banking-side.webp",
    footer: ["Evidence: Not connected", "Last updated: —", "Source not connected"], footerRight: "TIGERIS AI OS · Banking & Fintech",
    rows: [
      [
        { type: "map", span: 7, title: "Sector Asset Map", icon: "tree-palm", subtitle: "Key entities and flows across the banking & fintech ecosystem", img: "/command/banking-map.webp", ratio: 608 / 228, alt: "Illustrative diagram of liquidity sources, capital markets, fintech, payment infrastructure, counterparties and clients around a central bank" },
        { type: "glance", span: 5, title: "Key Risk & Exposure Areas", icon: "sparkle", subtitle: "Continuous monitoring across the financial system", items: [
          { title: "Liquidity & Funding Exposure", icon: "droplet" }, { title: "Counterparties", icon: "network" }, { title: "Credit Concentration", icon: "database" },
          { title: "Payment Continuity & Operational Resilience", icon: "credit-card" }, { title: "Financial Stress Scenarios", icon: "trending-up" }, { title: "Regulatory & Market Developments", icon: "file-text" }] },
      ],
      [
        { type: "chart", span: 4, title: "Liquidity and Funding Exposure", icon: "clock", subtitle: "Funding profile and liquidity buffers over time", chip: true, y: "Exposure (Index)", x: ["Q1", "Q2", "Q3", "Q4"], empty: [CAD, "Authorised banking and market data is required to display this analysis."], button: CAD },
        { type: "chart", span: 4, title: "Credit Concentration", icon: "settings", subtitle: "Exposure by sector or counterparty group", chip: true, y: "Exposure (%)", x: ["Top 5", "Top 10", "Top 20", "Others"], empty: [CAD, "Authorised banking data is required to display credit concentration."], button: CAD },
        { type: "chart", span: 4, title: "Payment Continuity", icon: "credit-card", subtitle: "Payment system volumes and uptime", chip: true, y: "Volume (Index)", x: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], empty: [CAD, "Authorised payment system data is required to display this analysis."], button: CAD },
      ],
      [
        { type: "list", span: 3, title: "Priority Intelligence Cases", icon: "target", subtitle: "Sector-specific intelligence and analysis", items: [
          { title: "Liquidity conditions and funding cost outlook", desc: "Assess domestic and external liquidity trends", icon: "target" },
          { title: "Counterparty credit risk signals", desc: "Monitor emerging risks across key counterparties", icon: "network" },
          { title: "Concentration risks in key sectors", desc: "Analyse exposure build-up and interconnections", icon: "share-2" },
          { title: "Payment system resilience", desc: "Assess operational continuity and settlement risks", icon: "refresh-cw" },
          { title: "Fintech growth and regulatory impact", desc: "Evaluate implications for stability and competition", icon: "wallet" }] },
        { type: "list", span: 3, title: "AI Specialist Activity", icon: "brain", subtitle: "Sector-focused AI analysis and monitoring", items: [
          { title: "Banking Risk Analyst", desc: "Liquidity, credit and market risk analysis", icon: "file-text", pill: AW },
          { title: "Payments Systems Analyst", desc: "Payment flows and operational resilience", icon: "refresh-cw", pill: AW },
          { title: "Fintech & Innovation Analyst", desc: "Market developments and adoption trends", icon: "sparkles", pill: AW },
          { title: "Regulatory Analyst", desc: "Regulatory changes and compliance impact", icon: "file-text", pill: AW },
          { title: "Financial Stability Analyst", desc: "Systemic risk and stress scenario analysis", icon: "landmark", pill: AW }] },
        { type: "list", span: 3, title: "Expert Review Queue", icon: "users", subtitle: "Items requiring human expert review", items: [
          { title: "Counterparty exposure alert", desc: "Review flagged exposure pattern", icon: "file-text", pill: { text: "Analysis review" } },
          { title: "Payment system resilience assessment", desc: "Validate scenario assumptions", icon: "file-text", pill: { text: "Scenario review" } },
          { title: "Credit concentration analysis", desc: "Confirm sector classification", icon: "file-text", pill: { text: "Data validation" } },
          { title: "Fintech regulatory impact", desc: "Review policy implications", icon: "file-text", pill: { text: "Policy review" } },
          { title: "Liquidity stress scenario results", desc: "Assess findings and recommendations", icon: "file-text", pill: { text: "Strategic review" } }] },
        { type: "list", span: 3, title: "Scenario Launch", icon: "chart-line", subtitle: "Model financial stress and resilience scenarios", dropdown: "Select scenario type", items: [
          { title: "Liquidity stress scenario", desc: "Assess funding and liquidity resilience", icon: "droplet" },
          { title: "Counterparty default scenario", desc: "Model contagion and exposure impacts", icon: "network" },
          { title: "Payment system disruption scenario", desc: "Evaluate operational resilience", icon: "credit-card" },
          { title: "Macro-financial stress scenario", desc: "Assess combined market and economic shocks", icon: "chart-line" }] },
      ],
      [{ type: "status", span: 12, title: "Mandate Checks and Decisions", icon: "shield", subtitle: "Governance, approvals and decision tracking", button: "View all decisions", items: [
        { title: "Items requiring approval", icon: "file-text" }, { title: "In review", icon: "hourglass" }, { title: "Approved", icon: "circle-check" }, { title: "Rejected", icon: "circle-x" }] }],
    ],
  },
  {
    key: "insurance", industry: "insurance", label: "Insurance", icon: "umbrella", badge: true,
    title: "Insurance Command Centre", subtitle: "Sector intelligence, risk, and decision support for a resilient insurance ecosystem.",
    right: {}, approvals: 1, side: "/command/insurance-side.webp", footer: FOOT, footerRight: "TIGERIS AI OS · Insurance",
    rows: [
      [{ type: "kpis", span: 12, items: [{ title: "Total Insured Exposure", icon: "database" }, { title: "Claims Intelligence", icon: "file-text" }, { title: "Catastrophe Concentration", icon: "triangle-alert" }, { title: "Reinsurance Dependencies", icon: "shield-plus" }, { title: "Underwriting Review", icon: "file-search" }] }],
      [
        { type: "map", span: 7, title: "Insurance Asset Map", icon: "map", subtitle: "Key exposure categories and insured asset concentration", chip: true, more: true, img: "/command/insurance-map.webp", ratio: 680 / 253, alt: "Illustrative map of urban assets, critical infrastructure, industry, transport and natural environment exposure" },
        { type: "chart", span: 5, title: "Insured Exposure by Category", icon: "chart-no-axes-column", chip: true, more: true, y: "Insured exposure", x: ["Property", "Energy & Industrial", "Infrastructure", "Transport", "Agriculture", "Other"], empty: [CAD, "Authorised data is required to display insured exposure."], button: CAD },
      ],
      [
        { type: "list", span: 4, title: "Priority Intelligence Cases", icon: "target", chip: true, more: true, items: [
          { title: "Catastrophe accumulation assessment", desc: "Assess concentrations and potential aggregation risk.", icon: "waves" },
          { title: "Climate and natural peril exposure", desc: "Evaluate long term physical and transition risks.", icon: "leaf" },
          { title: "Critical infrastructure dependency", desc: "Review insurance cover for essential services.", icon: "network" },
          { title: "Liability and emerging risk trends", desc: "Monitor emerging liabilities and new risk vectors.", icon: "scale" },
          { title: "Market and reinsurance capacity outlook", desc: "Assess capacity, pricing and potential constraints.", icon: "chart-no-axes-column" }] },
        { type: "list", span: 4, title: "AI Specialist Activity", icon: "network", chip: true, more: true, items: [
          { title: "Catastrophe Risk Analyst", desc: "Analyzes natural peril risk, accumulations and scenarios.", icon: "waves", pill: AW },
          { title: "Underwriting Intelligence Specialist", desc: "Reviews risk selection, pricing adequacy and terms.", icon: "file-text", pill: AW },
          { title: "Claims Pattern Analyst", desc: "Detects emerging claims trends and anomalies.", icon: "chart-line", pill: AW },
          { title: "Reinsurance Analyst", desc: "Assesses counterparty exposure and dependency.", icon: "shield", pill: AW },
          { title: "Regulatory & Compliance Advisor", desc: "Monitors regulatory developments and implications.", icon: "landmark", pill: AW }] },
        { type: "chart", span: 4, title: "Claims Intelligence", icon: "file-text", chip: true, more: true, y: "Claims volume", x: MONTHS, empty: [CAD, "Authorised data is required to display claims intelligence."], button: CAD },
      ],
      [
        { type: "table", span: 4, title: "Expert Review Queue", icon: "users", chip: true, more: true, columns: ["Title", "Type", "Priority", "Submitted", "Status"] },
        { type: "list", span: 4, title: "Scenario Launch", icon: "network", chip: true, more: true, items: [
          { title: "Major natural catastrophe scenario", desc: "Model multi region impact and insurance losses.", icon: "waves" },
          { title: "Market stress scenario", desc: "Assess impact of reduced reinsurance capacity.", icon: "chart-no-axes-column" },
          { title: "Climate transition scenario", desc: "Explore long term exposure and insurability.", icon: "leaf" },
          { title: "Emerging risk scenario", desc: "Model new technologies and liability scenarios.", icon: "network" }] },
        { type: "empty", span: 4, title: "Mandate Checks and Decisions", icon: "file-text", chip: true, more: true, tabs: ["Pending", "In Review", "Approved", "Not Approved"], empty: ["No pending items", "Authorised data is required to display mandate checks."], button: CAD },
      ],
    ],
  },
];
export const sectorByKey = (k: string) => SECTORS.find((s) => s.key === k);
export const sectorByIndustry = (i: string | null | undefined) => SECTORS.find((s) => s.industry === i);
