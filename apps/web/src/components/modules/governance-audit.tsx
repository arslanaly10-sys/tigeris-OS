"use client";
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useCan } from "../session-context";
import { AiGovernance } from "../ai-governance";

interface AuditEvent { seq: number; occurred_at: string; actor_type: string; actor_label: string; actor_role: string | null; action: string; resource_type: string; resource_id: string | null; details: Record<string, unknown>; hash: string; prev_hash: string }
interface Verify { ok: boolean; checked: number; headHash: string; firstBrokenSeq: number | null; reason: string | null }
interface Isolation { ok: boolean; ownPeopleVisible: number; foreignPeopleVisible: number; foreignAuditEventsVisible: number; enforcedBy: string; checkedAt: string }

const ACTION_TONE: Record<string, "ok" | "warn" | "crit" | "info" | "neutral"> = {
  "access.denied": "crit", "egress.blocked": "crit", "model.call_blocked": "warn", "sovereignty.settings_changed": "warn", "ask.refused_instruction": "crit", "agent_run.completed": "info", "export.created": "info", "confidence.adjusted": "info", "recommendation.feedback": "info", "session.signed_in": "ok", "audit.chain_verified": "info", "sovereignty.isolation_checked": "info", "demo.reset": "warn",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Riyadh" });

export function GovernanceAudit() {
  const can = useCan();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [verify, setVerify] = useState<Verify | { error: string } | null>(null);
  const [iso, setIso] = useState<Isolation | { error: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ events: AuditEvent[] }>("/audit/events?limit=100");
    if (r.ok) setEvents(r.data.events);
    else setDenied(r.message);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runVerify() {
    setBusy("verify");
    const r = await api<Verify>("/audit/verify", { json: {} });
    setVerify(r.ok ? r.data : { error: r.message });
    setBusy(null);
    load();
  }
  async function runIsolation() {
    setBusy("iso");
    const r = await api<Isolation>("/sovereignty/isolation-check", { json: {} });
    setIso(r.ok ? r.data : { error: r.message });
    setBusy(null);
    load();
  }

  return (
    <>
      <PageHeader nav="nav.governance" description="Every sign-in, role switch, refused request and check is written to an append-only audit trail. Each event is hash-linked to the one before it, so any later change is detectable." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Tamper evidence" title="Verify the audit chain" actions={<Button variant="primary" size="sm" onClick={runVerify} disabled={busy !== null}><Fingerprint />Verify now</Button>} />
          <div className="p-4 text-[13px]">
            {!verify && <p className="text-ink-muted">Recomputes the SHA-256 hash of every event in order and compares it to what was stored. Requires the Auditor role{can("audit.verify") ? "." : "; switch role from the menu to try it."}</p>}
            {verify && "error" in verify && <p role="alert" className="flex gap-2 text-crit"><ShieldAlert className="size-4 shrink-0" />{verify.error}</p>}
            {verify && "ok" in verify && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  {verify.ok ? <Badge tone="ok"><ShieldCheck />Chain intact</Badge> : <Badge tone="crit"><ShieldAlert />Chain broken at event {verify.firstBrokenSeq}</Badge>}
                  <span className="tabular text-ink-muted">{verify.checked} events checked</span>
                </div>
                {verify.reason && <p className="text-crit">{verify.reason}</p>}
                <p className="break-all font-mono text-[11.5px] text-ink-faint">Head hash {verify.headHash}</p>
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Sovereignty" title="Institution isolation check" actions={<Button variant="secondary" size="sm" onClick={runIsolation} disabled={busy !== null}><Lock />Run check</Button>} />
          <div className="p-4 text-[13px]">
            {!iso && <p className="text-ink-muted">Asks the database, from inside this institution&apos;s scope, how many people and audit events of the other demo institution it can see. The answer must be zero.</p>}
            {iso && "error" in iso && <p role="alert" className="flex gap-2 text-crit"><ShieldAlert className="size-4 shrink-0" />{iso.error}</p>}
            {iso && "ok" in iso && (
              <div className="grid gap-2">
                <Badge tone={iso.ok ? "ok" : "crit"} className="w-fit">{iso.ok ? <ShieldCheck /> : <ShieldAlert />}{iso.ok ? "Isolated" : "Isolation failure"}</Badge>
                <dl className="grid grid-cols-3 gap-3 tabular">
                  <div><dt className="text-ink-faint">Own people visible</dt><dd className="text-[18px] font-semibold">{iso.ownPeopleVisible}</dd></div>
                  <div><dt className="text-ink-faint">Other institution&apos;s people</dt><dd className="text-[18px] font-semibold">{iso.foreignPeopleVisible}</dd></div>
                  <div><dt className="text-ink-faint">Other institution&apos;s audit events</dt><dd className="text-[18px] font-semibold">{iso.foreignAuditEventsVisible}</dd></div>
                </dl>
                <p className="text-ink-faint">{iso.enforcedBy}</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <AiGovernance />

      <Panel className="mt-5">
        <PanelHeader eyebrow="Append-only" title="Audit trail" actions={events && <Badge className="tabular">{events.length} most recent</Badge>} />
        {denied && <p role="alert" className="p-4 text-[13px] text-crit">{denied}</p>}
        {!events && !denied && <div className="m-4 h-32 animate-pulse rounded bg-surface-2" />}
        {events && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="text-start text-ink-faint">
                <tr className="border-b border-line">
                  {["#", "Time (Riyadh)", "Actor", "Action", "Resource", "Hash"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.seq} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2 font-mono tabular text-ink-faint">{e.seq}</td>
                    <td className="whitespace-nowrap px-4 py-2 tabular text-ink-muted">{fmt(e.occurred_at)}</td>
                    <td className="px-4 py-2"><div>{e.actor_label}</div>{e.actor_role && <div className="text-[11.5px] text-ink-faint">{e.actor_role.replace("_", " ")}</div>}</td>
                    <td className="px-4 py-2"><Badge tone={ACTION_TONE[e.action] ?? "neutral"} className="font-mono">{e.action}</Badge></td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-ink-muted" title={e.resource_id ?? undefined}>{e.resource_type}{e.resource_id ? ` · ${e.resource_id}` : ""}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-ink-faint" title={e.hash}>{e.hash.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
