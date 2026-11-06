export interface FactDraft {
  subject: string;
  subjectLabel: string;
  predicate: string;
  predicateLabel: string;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: string | null;
  period?: string | null;
  qualifier?: string | null;
  claimClass: "observed" | "sourced" | "inferred" | "assumed" | "synthetic" | "illustrative";
  reviewState?: "accepted" | "needs_review";
  locator: string;
  excerpt?: string | null;
  method: string;
}

export interface ParseResult {
  facts: FactDraft[];
  /** Text extracted from documents; screened for injection before anything else sees it. */
  text?: string;
  /** Structural signals for validation, e.g. text drawn below a legible size. */
  signals?: { hiddenTextChars?: number; pages?: number };
}

export const COUNTRY: Record<string, string> = {
  SAU: "Saudi Arabia", ARE: "United Arab Emirates", QAT: "Qatar", KWT: "Kuwait", OMN: "Oman", BHR: "Bahrain",
  SA: "Saudi Arabia", AE: "United Arab Emirates", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain",
};
export const ISO2_TO_3: Record<string, string> = { SA: "SAU", AE: "ARE", QA: "QAT", KW: "KWT", OM: "OMN", BH: "BHR" };
