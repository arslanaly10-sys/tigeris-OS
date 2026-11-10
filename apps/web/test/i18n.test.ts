import { describe, expect, it } from "vitest";
import { AR_STRINGS, EN_STRINGS } from "../src/lib/i18n";
import { MODULES } from "../src/lib/modules";

describe("Arabic coverage for navigation and key screens (Q016)", () => {
  it("every navigation label has an Arabic draft", () => {
    for (const m of MODULES) expect(AR_STRINGS[m.nav], m.nav).toBeTruthy();
  });
  it("every header and sign-in string has an Arabic draft", () => {
    const keys = Object.keys(EN_STRINGS).filter((k) => k.startsWith("header.") || k.startsWith("signin.") || k.startsWith("group."));
    for (const k of keys) expect(AR_STRINGS[k as keyof typeof EN_STRINGS], k).toBeTruthy();
  });
  it("defines the PRD's eleven modules plus Reports, Sovereignty (9 Nov 2026), Architecture and About", () => {
    expect(MODULES.filter((m) => m.group !== "meta")).toHaveLength(19);
    expect(MODULES.map((m) => m.slug)).toEqual(expect.arrayContaining(["command-centre", "graph", "domains", "reports", "sovereignty"]));
  });
});
