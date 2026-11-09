/** Seven demo roles (Q020, PRD §4). */
export const ROLES = [
  "executive",
  "analyst",
  "domain_expert",
  "approver",
  "operations_owner",
  "administrator",
  "auditor",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permissions are separate for records, actions and exports (FR-03).
 * Every protected API route checks one of these server-side (TR-044).
 */
export const PERMISSIONS = [
  "case.read",
  "case.create",
  "case.edit",
  "case.comment",
  "evidence.read",
  "evidence.dispose", // corroborate / challenge / dismiss
  "evidence.upload", // add a document or signal (Q052)
  "source.manage",
  "scenario.run",
  "recommendation.draft",
  "decision.approve",
  "handoff.update",
  "policy.read",
  "policy.edit",
  "admin.manage",
  "audit.read",
  "audit.verify",
  "export.create",
  "sovereignty.control", // offline switch, model allowlist
  "diagnostic.run", // run and save a sovereign gap diagnostic
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  executive: ["case.read", "case.comment", "evidence.read", "decision.approve", "export.create", "policy.read", "audit.read", "diagnostic.run"],
  analyst: [
    "case.read", "case.create", "case.edit", "case.comment", "evidence.read", "evidence.dispose", "evidence.upload",
    "scenario.run", "recommendation.draft", "export.create", "policy.read", "diagnostic.run",
  ],
  domain_expert: ["case.read", "case.comment", "evidence.read", "evidence.dispose", "evidence.upload", "scenario.run", "policy.read", "diagnostic.run"],
  approver: ["case.read", "case.comment", "evidence.read", "decision.approve", "policy.read", "audit.read"],
  operations_owner: ["case.read", "case.comment", "evidence.read", "handoff.update"],
  administrator: [
    "case.read", "evidence.read", "evidence.upload", "source.manage", "policy.read", "policy.edit", "admin.manage",
    "audit.read", "sovereignty.control",
  ],
  auditor: ["case.read", "evidence.read", "policy.read", "audit.read", "audit.verify"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  executive: "Executive / Governor",
  analyst: "Analyst",
  domain_expert: "Domain Expert",
  approver: "Approver",
  operations_owner: "Operations Owner",
  administrator: "Administrator",
  auditor: "Auditor",
};

/** Executives see a spacious layout; analysts and experts a dense one (Q015). */
export const ROLE_DENSITY: Record<Role, "spacious" | "dense"> = {
  executive: "spacious",
  approver: "spacious",
  analyst: "dense",
  domain_expert: "dense",
  operations_owner: "dense",
  administrator: "dense",
  auditor: "dense",
};
