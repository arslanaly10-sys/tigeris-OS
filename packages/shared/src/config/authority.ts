/**
 * Authority matrix (brief v3 §6.1). Who may approve what, by type and size. Used to state "Who has authority?" and
 * "What requires approval?" on every decision package. Roles map to the product's permission roles.
 */
export interface AuthorityRule { id: string; action: string; maxPctOfMandate: number | null; authority: string; role: "approver" | "executive"; approvals: number; note: string }
export const AUTHORITY_VERSION = "authority.v1";
export const AUTHORITY: AuthorityRule[] = [
  { id: "gov-officer-3pct", action: "reallocation", maxPctOfMandate: 3, authority: "Governance Officer, within the board's standing envelope", role: "approver", approvals: 1, note: "Reallocations up to 3% of the mandate inside approved sleeve ranges" },
  { id: "board-above-3pct", action: "reallocation", maxPctOfMandate: null, authority: "Board investment committee", role: "executive", approvals: 2, note: "Anything above 3% of the mandate" },
  { id: "exco-facility", action: "facility", maxPctOfMandate: null, authority: "Executive committee", role: "executive", approvals: 1, note: "Insurance or liquidity facilities" },
];
export function authorityFor(action: string, pctOfMandate: number): AuthorityRule {
  return AUTHORITY.filter((r) => r.action === action).find((r) => r.maxPctOfMandate === null || pctOfMandate <= r.maxPctOfMandate) ?? AUTHORITY[1]!;
}
