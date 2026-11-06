"use client";
import { CheckCircle2, Inbox, Map as MapIcon, MinusCircle } from "lucide-react";
import { PERMISSIONS, ROLE_LABELS, type Permission } from "@tigeris/shared";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { useSession } from "../session-context";

const PERMISSION_TEXT: Record<Permission, string> = {
  "case.read": "Read intelligence cases",
  "case.create": "Open new cases",
  "case.edit": "Edit case analysis",
  "case.comment": "Comment and mention colleagues",
  "evidence.read": "Read evidence and lineage",
  "evidence.dispose": "Corroborate, challenge or dismiss evidence",
  "evidence.upload": "Add documents and signals",
  "source.manage": "Register and approve sources",
  "scenario.run": "Run what-if scenarios",
  "recommendation.draft": "Draft recommended actions",
  "decision.approve": "Approve, reject or defer decisions",
  "handoff.update": "Update approved follow-through tasks",
  "policy.read": "Read governance policies",
  "policy.edit": "Edit and test policies",
  "admin.manage": "Manage people, roles and settings",
  "audit.read": "Read the audit trail",
  "audit.verify": "Verify the audit chain",
  "export.create": "Export briefs and reports",
  "sovereignty.control": "Control offline mode and model allowlist",
};

export function CommandCentre() {
  const s = useSession();
  return (
    <>
      <PageHeader nav="nav.command-centre" description={`Good to see you, ${s.principal.name.split(" ")[0]}. This is where items that need your attention will appear, with the reason each one is surfaced.`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader eyebrow="Attention queue" title="Needs attention" actions={<Badge tone="neutral" className="tabular">0 items</Badge>} />
          <div className="geo-pattern m-4 grid place-items-center gap-3 rounded-md border border-dashed border-line px-6 py-12 text-center">
            <Inbox className="size-7 text-accent" />
            <div className="font-semibold">No signals or cases yet</div>
            <p className="max-w-[48ch] text-[13px] text-ink-muted">
              Validated public evidence is already in Data & Sources. Signals, cases, reviews and approvals join this queue in week 3.
            </p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Gulf strategic view" title="Map" actions={<Badge tone="gold">Week 4</Badge>} />
          <div className="geo-pattern m-4 grid min-h-[240px] place-items-center gap-3 rounded-md border border-dashed border-line px-6 py-10 text-center">
            <MapIcon className="size-7 text-accent" />
            <p className="max-w-[46ch] text-[13px] text-ink-muted">
              A dark GCC map with ports, pipelines, refineries, desalination and power plants, shipping corridors and about 200 ships in replay. It works offline from packaged map tiles.
            </p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Signed in as" title={ROLE_LABELS[s.principal.role]} actions={<Badge tone="info">{s.density === "spacious" ? "Executive layout" : "Analyst layout"}</Badge>} />
          <ul className="grid gap-1 p-4 sm:grid-cols-2">
            {PERMISSIONS.map((p) => {
              const has = s.permissions.includes(p);
              return (
                <li key={p} className="flex items-center gap-2 text-[13px]">
                  {has ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="Allowed" /> : <MinusCircle className="size-4 shrink-0 text-ink-faint" aria-label="Not allowed" />}
                  <span className={has ? "text-ink" : "text-ink-faint"}>{PERMISSION_TEXT[p]}</span>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-4 py-3 text-[12px] text-ink-muted">Every route checks these permissions on the server. Attempts outside your role are refused and recorded in the audit trail.</p>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Institution" title={s.institution.name} />
          <dl className="grid gap-x-6 gap-y-3 p-4 text-[13px] sm:grid-cols-2">
            {[
              ["Buyer category", s.institution.buyerCategory],
              ["Country", s.institution.country],
              ["Data residency", s.institution.residency],
              ["Deployment profile", "Controlled demo · local package ready"],
              ["Data mode", "Public snapshots + synthetic data"],
              ["Data isolation", "Row-level security per institution"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-4 py-3 text-[12px] text-ink-muted">This institution and its people are fictional. Run the isolation check from Governance & Audit to prove the other demo institution is invisible from here.</p>
        </Panel>
      </div>
    </>
  );
}
