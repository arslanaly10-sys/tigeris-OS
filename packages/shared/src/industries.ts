import type { Role } from "./roles";

/**
 * Industries a user can work in (sign-in lens). Twelve: the eight domain packs (SCOPE §8) plus four added
 * on 9 Nov 2026 (defence and security, healthcare, telecoms, transport and aviation).
 * Permissions stay the seven roles; each industry only adds the job titles people recognise, mapped onto them.
 * Arabic names and titles are a draft until a client reviewer approves them.
 */
export type IndustryKey =
  | "sovereign_capital" | "energy" | "banking" | "supply_chain" | "infrastructure" | "manufacturing"
  | "construction_real_estate" | "insurance" | "defence_security" | "healthcare" | "telecoms" | "transport_aviation";

export interface Industry {
  key: IndustryKey;
  name: string;
  nameAr: string;
  /** One line under the name on the sign-in card. */
  focus: string;
  focusAr: string;
  /** Lucide icon name used by the web app. */
  icon: string;
  /** Graph entity types this industry looks at first. */
  entityTypes: string[];
  /** Map layers switched on first for this industry (Movement Map layer keys). */
  mapLayers: string[];
  /** Job title per permission role, in English and Arabic. */
  titles: Record<Role, [string, string]>;
}

export const INDUSTRIES: Industry[] = [
  {
    key: "sovereign_capital", name: "Sovereign capital and investment", nameAr: "رأس المال السيادي والاستثمار",
    focus: "Mandates, holdings, exposures and capital allocation", focusAr: "التفويضات والحيازات والانكشافات وتخصيص رأس المال",
    icon: "Landmark", entityTypes: ["institution", "mandate", "holding", "country"], mapLayers: ["ports", "chokepoints", "signals"],
    titles: {
      executive: ["Governor", "المحافظ"], analyst: ["Investment Intelligence Analyst", "محلل استخبارات الاستثمار"],
      domain_expert: ["Portfolio Strategist", "استراتيجي المحافظ"], approver: ["Chief Investment Officer", "رئيس الاستثمار"],
      operations_owner: ["Head of Portfolio Operations", "رئيس عمليات المحافظ"], administrator: ["Investment Platform Administrator", "مسؤول منصة الاستثمار"],
      auditor: ["Investment Audit Lead", "رئيس تدقيق الاستثمار"],
    },
  },
  {
    key: "energy", name: "Energy, oil and gas", nameAr: "الطاقة والنفط والغاز",
    focus: "Fields, processing, pipelines, terminals and export routes", focusAr: "الحقول والمعالجة وخطوط الأنابيب والمحطات ومسارات التصدير",
    icon: "Flame", entityTypes: ["field", "facility", "pipeline", "refinery", "terminal", "chokepoint"], mapLayers: ["vessels", "observed", "lanes", "pipelines", "refineries", "ports", "chokepoints"],
    titles: {
      executive: ["Chief Executive, Energy", "الرئيس التنفيذي للطاقة"], analyst: ["Energy Market Analyst", "محلل أسواق الطاقة"],
      domain_expert: ["Head of Crude Trading", "رئيس تداول النفط الخام"], approver: ["Chief Risk Officer, Energy", "رئيس المخاطر للطاقة"],
      operations_owner: ["Terminal Operations Lead", "رئيس عمليات المحطات"], administrator: ["Energy Systems Administrator", "مسؤول أنظمة الطاقة"],
      auditor: ["Energy Compliance Auditor", "مدقق امتثال الطاقة"],
    },
  },
  {
    key: "banking", name: "Banking and fintech", nameAr: "البنوك والتقنية المالية",
    focus: "Liquidity, funding costs, counterparty and market exposure", focusAr: "السيولة وتكلفة التمويل والأطراف المقابلة وانكشاف السوق",
    icon: "Banknote", entityTypes: ["country", "holding", "institution"], mapLayers: ["signals"],
    titles: {
      executive: ["Chief Executive, Banking", "الرئيس التنفيذي للبنوك"], analyst: ["Liquidity Risk Analyst", "محلل مخاطر السيولة"],
      domain_expert: ["Treasury and Markets Adviser", "مستشار الخزينة والأسواق"], approver: ["Chief Risk Officer", "رئيس المخاطر"],
      operations_owner: ["Head of Treasury Operations", "رئيس عمليات الخزينة"], administrator: ["Core Systems Administrator", "مسؤول الأنظمة الأساسية"],
      auditor: ["Internal Audit, Financial Risk", "التدقيق الداخلي للمخاطر المالية"],
    },
  },
  {
    key: "supply_chain", name: "Supply chain and logistics", nameAr: "سلاسل الإمداد والخدمات اللوجستية",
    focus: "Ports, corridors, routes, cargo and alternatives", focusAr: "الموانئ والممرات والمسارات والشحنات والبدائل",
    icon: "Container", entityTypes: ["port", "route", "airport", "commodity", "vessel"], mapLayers: ["vessels", "observed", "trucks", "lanes", "roads", "ports", "chokepoints", "observed_air"],
    titles: {
      executive: ["Chief Supply Chain Officer", "رئيس سلاسل الإمداد"], analyst: ["Logistics Intelligence Analyst", "محلل استخبارات الخدمات اللوجستية"],
      domain_expert: ["Maritime and Freight Adviser", "مستشار الشحن البحري"], approver: ["Head of Procurement Risk", "رئيس مخاطر المشتريات"],
      operations_owner: ["Port and Fleet Operations Lead", "رئيس عمليات الموانئ والأسطول"], administrator: ["Logistics Platform Administrator", "مسؤول منصة الخدمات اللوجستية"],
      auditor: ["Supply Chain Auditor", "مدقق سلاسل الإمداد"],
    },
  },
  {
    key: "infrastructure", name: "Infrastructure and utilities", nameAr: "البنية التحتية والمرافق",
    focus: "Water, power and the services that depend on them", focusAr: "المياه والكهرباء والخدمات المعتمدة عليهما",
    icon: "Zap", entityTypes: ["desalination", "power_plant", "city"], mapLayers: ["desal", "power", "pipelines", "signals"],
    titles: {
      executive: ["Chief Executive, Utilities", "الرئيس التنفيذي للمرافق"], analyst: ["Resilience Analyst", "محلل المرونة"],
      domain_expert: ["Water and Power Systems Engineer", "مهندس أنظمة المياه والكهرباء"], approver: ["Head of Asset Risk", "رئيس مخاطر الأصول"],
      operations_owner: ["Grid and Plant Operations Lead", "رئيس عمليات الشبكة والمحطات"], administrator: ["Operational Technology Administrator", "مسؤول التقنيات التشغيلية"],
      auditor: ["Utilities Regulatory Auditor", "مدقق تنظيم المرافق"],
    },
  },
  {
    key: "manufacturing", name: "Manufacturing and industrials", nameAr: "التصنيع والصناعات",
    focus: "Plants, inputs, suppliers and production continuity", focusAr: "المصانع والمدخلات والموردون واستمرارية الإنتاج",
    icon: "Factory", entityTypes: ["refinery", "facility", "holding", "commodity"], mapLayers: ["refineries", "ports", "trucks", "roads"],
    titles: {
      executive: ["Chief Operating Officer, Industrials", "الرئيس التنفيذي للعمليات الصناعية"], analyst: ["Industrial Supply Analyst", "محلل الإمداد الصناعي"],
      domain_expert: ["Plant Engineering Adviser", "مستشار هندسة المصانع"], approver: ["Head of Operational Risk", "رئيس المخاطر التشغيلية"],
      operations_owner: ["Production Planning Lead", "رئيس تخطيط الإنتاج"], administrator: ["Manufacturing Systems Administrator", "مسؤول أنظمة التصنيع"],
      auditor: ["Quality and Compliance Auditor", "مدقق الجودة والامتثال"],
    },
  },
  {
    key: "construction_real_estate", name: "Construction and real estate", nameAr: "الإنشاءات والعقارات",
    focus: "Projects, materials, contractors and asset values", focusAr: "المشاريع والمواد والمقاولون وقيم الأصول",
    icon: "Building2", entityTypes: ["city", "holding", "port"], mapLayers: ["ports", "roads", "trucks"],
    titles: {
      executive: ["Chief Executive, Real Estate", "الرئيس التنفيذي للعقارات"], analyst: ["Project Risk Analyst", "محلل مخاطر المشاريع"],
      domain_expert: ["Construction Cost Adviser", "مستشار تكاليف الإنشاءات"], approver: ["Head of Development Risk", "رئيس مخاطر التطوير"],
      operations_owner: ["Programme Delivery Lead", "رئيس تنفيذ البرامج"], administrator: ["Projects Platform Administrator", "مسؤول منصة المشاريع"],
      auditor: ["Projects Assurance Auditor", "مدقق ضمان المشاريع"],
    },
  },
  {
    key: "insurance", name: "Insurance", nameAr: "التأمين",
    focus: "Marine, war-risk and sanctions exposure", focusAr: "انكشاف التأمين البحري ومخاطر الحرب والعقوبات",
    icon: "ShieldCheck", entityTypes: ["vessel", "sanctions_regime", "holding"], mapLayers: ["vessels", "observed", "chokepoints", "lanes"],
    titles: {
      executive: ["Chief Executive, Insurance", "الرئيس التنفيذي للتأمين"], analyst: ["Marine Risk Analyst", "محلل المخاطر البحرية"],
      domain_expert: ["Underwriting Adviser", "مستشار الاكتتاب"], approver: ["Chief Underwriting Officer", "رئيس الاكتتاب"],
      operations_owner: ["Claims Operations Lead", "رئيس عمليات المطالبات"], administrator: ["Insurance Platform Administrator", "مسؤول منصة التأمين"],
      auditor: ["Actuarial Assurance Auditor", "مدقق الضمان الاكتواري"],
    },
  },
  {
    key: "defence_security", name: "Defence and security", nameAr: "الدفاع والأمن",
    focus: "Maritime security, critical sites and navigation safety", focusAr: "الأمن البحري والمواقع الحيوية وسلامة الملاحة",
    icon: "Shield", entityTypes: ["chokepoint", "port", "airport", "facility"], mapLayers: ["vessels", "observed", "chokepoints", "ports", "airports", "signals", "aircraft", "observed_air"],
    titles: {
      executive: ["Director General, Security", "المدير العام للأمن"], analyst: ["Maritime Security Analyst", "محلل الأمن البحري"],
      domain_expert: ["Navigation Safety Adviser", "مستشار سلامة الملاحة"], approver: ["Head of Security Risk", "رئيس المخاطر الأمنية"],
      operations_owner: ["Watch and Operations Lead", "رئيس المراقبة والعمليات"], administrator: ["Secure Systems Administrator", "مسؤول الأنظمة الآمنة"],
      auditor: ["Security Oversight Auditor", "مدقق الرقابة الأمنية"],
    },
  },
  {
    key: "healthcare", name: "Healthcare", nameAr: "الرعاية الصحية",
    focus: "Medicine supply, hospital capacity and public health", focusAr: "إمداد الأدوية والطاقة الاستيعابية للمستشفيات والصحة العامة",
    icon: "HeartPulse", entityTypes: ["city", "port", "airport", "commodity"], mapLayers: ["airports", "ports", "signals", "aircraft", "observed_air"],
    titles: {
      executive: ["Chief Executive, Health", "الرئيس التنفيذي للصحة"], analyst: ["Health Supply Analyst", "محلل الإمداد الصحي"],
      domain_expert: ["Pharmaceutical Supply Adviser", "مستشار الإمداد الدوائي"], approver: ["Chief Medical Officer", "كبير المسؤولين الطبيين"],
      operations_owner: ["Hospital Operations Lead", "رئيس عمليات المستشفيات"], administrator: ["Health Systems Administrator", "مسؤول الأنظمة الصحية"],
      auditor: ["Clinical Governance Auditor", "مدقق الحوكمة السريرية"],
    },
  },
  {
    key: "telecoms", name: "Telecoms and digital", nameAr: "الاتصالات والقطاع الرقمي",
    focus: "Subsea cables, data centres and network resilience", focusAr: "الكابلات البحرية ومراكز البيانات ومرونة الشبكات",
    icon: "RadioTower", entityTypes: ["city", "facility", "chokepoint"], mapLayers: ["chokepoints", "power", "signals"],
    titles: {
      executive: ["Chief Executive, Telecoms", "الرئيس التنفيذي للاتصالات"], analyst: ["Network Resilience Analyst", "محلل مرونة الشبكات"],
      domain_expert: ["Subsea Cable Engineer", "مهندس الكابلات البحرية"], approver: ["Chief Technology Risk Officer", "رئيس المخاطر التقنية"],
      operations_owner: ["Network Operations Centre Lead", "رئيس مركز عمليات الشبكة"], administrator: ["Platform and Identity Administrator", "مسؤول المنصة والهوية"],
      auditor: ["Technology Assurance Auditor", "مدقق الضمان التقني"],
    },
  },
  {
    key: "transport_aviation", name: "Transport and aviation", nameAr: "النقل والطيران",
    focus: "Airports, air corridors, ports and road freight", focusAr: "المطارات والممرات الجوية والموانئ والشحن البري",
    icon: "Plane", entityTypes: ["airport", "port", "route", "city"], mapLayers: ["airports", "ports", "trucks", "roads", "vessels", "lanes", "aircraft", "observed_air", "air_routes"],
    titles: {
      executive: ["Chief Executive, Transport", "الرئيس التنفيذي للنقل"], analyst: ["Network Planning Analyst", "محلل تخطيط الشبكات"],
      domain_expert: ["Air Traffic and Routes Adviser", "مستشار الحركة الجوية والمسارات"], approver: ["Head of Safety and Risk", "رئيس السلامة والمخاطر"],
      operations_owner: ["Hub Operations Lead", "رئيس عمليات المحور"], administrator: ["Transport Systems Administrator", "مسؤول أنظمة النقل"],
      auditor: ["Safety Compliance Auditor", "مدقق امتثال السلامة"],
    },
  },
];

export const INDUSTRY_KEYS = INDUSTRIES.map((i) => i.key) as IndustryKey[];
export const DEFAULT_INDUSTRY: IndustryKey = "sovereign_capital";
export const industryOf = (key: string | null | undefined): Industry | undefined => INDUSTRIES.find((i) => i.key === key);
export const isIndustry = (key: unknown): key is IndustryKey => typeof key === "string" && INDUSTRY_KEYS.includes(key as IndustryKey);

/** The job title a person holds in an industry lens, from their permission role. */
export function jobTitle(industry: string | null | undefined, role: Role, lang: "en" | "ar" = "en"): string | undefined {
  const t = industryOf(industry)?.titles[role];
  return t ? t[lang === "ar" ? 1 : 0] : undefined;
}
