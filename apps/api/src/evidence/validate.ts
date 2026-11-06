/**
 * Validation rule set v1 (FR-09, TR-007..TR-011, Q099). Runs on every evidence object before
 * anything it contains can reach the graph, a model or a recommendation.
 * fail → quarantined (or rejected for integrity failures); warn → accepted with a visible warning.
 */
export const RULE_SET_VERSION = "validation.v1";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MEDIA = ["application/json", "text/csv", "text/html", "application/pdf"];

export type CheckResult = "pass" | "warn" | "fail";
export interface Check { rule: string; label: string; result: CheckResult; detail: string }

/** Instruction-like text aimed at an AI system. Matching documents are quarantined, never parsed further. */
const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/ignore (all )?(previous|prior|above) (instructions|prompts?)/i, "asks to ignore previous instructions"],
  [/\b(you are now|act as) (the )?(approver|administrator|system|an? ai)/i, "tries to assign itself a role"],
  [/\bsystem\s*(prompt|:)/i, "addresses the system prompt"],
  [/do not (record|log|audit)/i, "asks not to record its actions"],
  [/(mark|set) (every|all) (recommendations?|decisions?) (as )?approved/i, "asks to approve decisions"],
  [/<\s*\/?\s*(script|iframe)/i, "contains script markup"],
];

export function screenInjection(text: string): { hits: string[]; excerpt: string | null } {
  const hits: string[] = [];
  let excerpt: string | null = null;
  for (const [re, label] of INJECTION_PATTERNS) {
    const m = text.match(re);
    if (m) {
      hits.push(label);
      if (!excerpt) {
        const i = Math.max(0, (m.index ?? 0) - 40);
        excerpt = text.slice(i, i + 200).trim();
      }
    }
  }
  return { hits, excerpt };
}

export function outcomeOf(checks: Check[]): "accepted" | "warning" | "quarantined" | "rejected" {
  if (checks.some((c) => c.result === "fail" && c.rule.startsWith("integrity."))) return "rejected";
  if (checks.some((c) => c.result === "fail")) return "quarantined";
  if (checks.some((c) => c.result === "warn")) return "warning";
  return "accepted";
}
