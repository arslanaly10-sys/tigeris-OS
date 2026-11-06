import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLES, ROLE_PERMISSIONS } from "../src";

describe("permission matrix (FR-03)", () => {
  it("every role has a defined permission list using known permissions", () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });
  it("only executives and approvers can approve decisions", () => {
    const approvers = ROLES.filter((r) => can(r, "decision.approve"));
    expect(approvers.sort()).toEqual(["approver", "executive"]);
  });
  it("analysts can draft recommendations but cannot approve them", () => {
    expect(can("analyst", "recommendation.draft")).toBe(true);
    expect(can("analyst", "decision.approve")).toBe(false);
  });
  it("auditors are read-only and can verify the audit chain", () => {
    expect(can("auditor", "audit.verify")).toBe(true);
    expect(can("auditor", "case.edit")).toBe(false);
    expect(can("auditor", "export.create")).toBe(false);
  });
  it("only administrators edit policy or control sovereignty", () => {
    expect(ROLES.filter((r) => can(r, "policy.edit"))).toEqual(["administrator"]);
    expect(ROLES.filter((r) => can(r, "sovereignty.control"))).toEqual(["administrator"]);
  });
  it("operations owners can update handoffs and nothing privileged", () => {
    expect(can("operations_owner", "handoff.update")).toBe(true);
    expect(can("operations_owner", "policy.edit")).toBe(false);
    expect(can("operations_owner", "decision.approve")).toBe(false);
  });
});
