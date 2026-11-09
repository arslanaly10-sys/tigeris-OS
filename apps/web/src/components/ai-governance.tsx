"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, CircleSlash, Globe2, HardDrive, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { requireText, clearInvalid, useUnsavedWarning } from "@/lib/forms";
import { formatDate, num } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { AGENT_LABEL } from "./agents";

interface Settings { foreign_models_enabled: boolean; outbound_allowed: boolean; allowed_providers: string[]; default_provider: string; foreign_max_classification: string; version: number; updated_by_label: string; updated_at: string }
interface Provider { key: string; label: string; vendor: string; foreign: boolean; model: string; hosts: string[]; residency: string; priceInPerM: number | null; priceOutPerM: number | null; allowlisted: boolean; keyConfigured: boolean; usable: boolean; blockedBy: string | null; reason: string | null; local?: { file?: string; sha256?: string | null; size_bytes?: number; threads?: number; loaded?: boolean; present?: boolean; network?: string } }
interface Usage {
  byProvider: Array<{ provider: string; outcome: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number; ms: number }>;
  byAgent: Array<{ agent_key: string; calls: number; blocked: number; tokens: number; cost_usd: number; ms: number }>;
  runs: Array<{ id: string; kind: string; status: string; provider_requested: string; question: string | null; tokens_in: number; tokens_out: number; cost_usd: number; model_calls: number; requested_by_label: string; started_at: string; case_key: string | null }>;
  recentBlocked: Array<{ agent_key: string; provider: string; reason: string; classification: string; created_at: string }>;
}
interface Agent { key: string; name: string; purpose: string; tools: string[]; may: string[]; mayNot: string[] }

const CHECK_LABEL: Record<string, string> = { allowlist: "Not on allowlist", foreign_switch: "Foreign models off", classification: "Classification ceiling", egress: "Outbound off", credentials: "No key configured", model_file: "Model file missing" };

/** Sovereignty controls for models (Q061..Q063, Q069, TR-021..TR-024). */
export function AiGovernance() {
  const can = useCan();
  const editable = can("sovereignty.control");
  const [status, setStatus] = useState<{ settings: Settings; providers: Provider[] } | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pending, setPending] = useState<Partial<Settings> | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [s, u, a] = await Promise.all([api<{ settings: Settings; providers: Provider[] }>("/ai/status"), api<Usage>("/ai/usage"), api<{ agents: Agent[] }>("/ai/agents")]);
    if (s.ok) setStatus(s.data);
    if (u.ok) setUsage(u.data);
    if (a.ok) setAgents(a.data.agents);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!status) return <div className="h-60 animate-pulse rounded-lg bg-surface-2" />;
  const s = { ...status.settings, ...pending };
  const change = (p: Partial<Settings>) => setPending({ ...pending, ...p });
  async function save() {
    const bad = requireText(reason, 3, "sov-reason", "The reason for the change");
    if (bad) { setMsg(bad); return; }
    clearInvalid("sov-reason");
    const r = await api<{ settings: Settings }>("/ai/settings", { method: "PUT", json: { ...pending, reason } });
    if (!r.ok) { setMsg(r.message); return; }
    setMsg("Saved and recorded on the audit trail.");
    setPending(null); setReason(""); load();
  }
  const totals = (usage?.byProvider ?? []).reduce((t, r) => ({ calls: t.calls + (r.outcome === "ok" ? r.calls : 0), cached: t.cached + (r.outcome === "cached" ? r.calls : 0), blocked: t.blocked + (r.outcome === "blocked" ? r.calls : 0), tokens: t.tokens + r.tokens_in + r.tokens_out, cost: t.cost + r.cost_usd, ms: t.ms + r.ms }), { calls: 0, cached: 0, blocked: 0, tokens: 0, cost: 0, ms: 0 });
  return (
    <section id="ai" className="mt-5 grid gap-5" aria-labelledby="ai-heading">
      <h2 id="ai-heading" className="text-[20px] font-medium">AI models and agents</h2>
      <Panel className={cn("p-5", s.foreign_models_enabled ? "border-warn/50" : "border-ok/40")}>
        <div className="flex flex-wrap items-center gap-5">
          <div className={cn("grid size-14 place-items-center rounded-full border-2", s.foreign_models_enabled ? "border-warn text-warn" : "border-ok text-ok")}>{s.foreign_models_enabled ? <Globe2 className="size-7" /> : <Lock className="size-7" />}</div>
          {/* At least 16rem (or the full row) so on a phone the text wraps below the icon instead of shrinking to nothing. */}
          <div className="min-w-[min(100%,16rem)] flex-1">
            <div className="eyebrow text-ink-faint">Sovereignty switch</div>
            <div className="text-[22px] font-medium">{s.foreign_models_enabled ? "Foreign models allowed" : "Foreign models cut"}</div>
            <p className="text-[13px] text-ink-muted">{s.foreign_models_enabled ? `Foreign models may be called for content up to ${s.foreign_max_classification}, if outbound access, the allowlist and a key also allow it.` : "Every agent runs on the local model or the deterministic writer. No prompt leaves this institution."}</p>
          </div>
          <Button size="lg" variant={s.foreign_models_enabled ? "primary" : "secondary"} disabled={!editable} onClick={() => change({ foreign_models_enabled: !s.foreign_models_enabled })} aria-pressed={s.foreign_models_enabled}>
            {s.foreign_models_enabled ? <><CircleSlash />Cut foreign models</> : <><Globe2 />Allow foreign models</>}
          </Button>
        </div>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 text-[13px] md:grid-cols-3">
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={s.outbound_allowed} disabled={!editable} onChange={(e) => change({ outbound_allowed: e.target.checked })} /><span><span className="font-medium">Outbound access</span><br /><span className="text-ink-muted">{s.outbound_allowed ? "Allowed, only to each provider's own host" : "Off: the gateway blocks every outbound call"}</span></span></label>
          <label className="grid gap-1"><span className="font-medium">Highest classification a foreign model may see</span>
            <select value={s.foreign_max_classification} disabled={!editable} onChange={(e) => change({ foreign_max_classification: e.target.value })} className="h-8 rounded-md border border-line bg-surface-2 px-2">{["public", "internal", "confidential"].map((c) => <option key={c}>{c}</option>)}</select>
            <span className="text-[13px] text-ink-faint">Secret content never leaves, whatever this is set to.</span></label>
          <label className="grid gap-1"><span className="font-medium">Default model</span>
            <select value={s.default_provider} disabled={!editable} onChange={(e) => change({ default_provider: e.target.value })} className="h-8 rounded-md border border-line bg-surface-2 px-2">{status.providers.filter((p) => s.allowed_providers.includes(p.key)).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
        </div>
        {pending && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <label className="grid flex-1 gap-1 text-[13px] text-ink-muted">Reason for the change (required, audited)<input autoComplete="off" id="sov-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 rounded-md border border-line bg-surface-2 px-2 text-ink" /></label>
            <Button variant="primary" onClick={save}>Save change</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        )}
        {msg && <p role="status" className="mt-2 text-[13px] text-ink-muted">{msg}</p>}
        <p className="mt-3 text-[13px] text-ink-faint">Version {status.settings.version} · last changed by {status.settings.updated_by_label} · {formatDate(status.settings.updated_at, true)}{!editable && " · Only an administrator can change these controls."}</p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {status.providers.map((p) => (
          <Panel key={p.key} className="grid gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {p.foreign ? <Globe2 className="size-4 text-warn" /> : p.key === "local" ? <HardDrive className="size-4 text-ok" /> : <Bot className="size-4 text-ink-muted" />}
              <span className="font-medium">{p.label}</span>
              <Badge tone={p.usable ? "ok" : "warn"} className="ms-auto">{p.usable ? <ShieldCheck /> : <ShieldAlert />}{p.usable ? "Usable" : CHECK_LABEL[p.blockedBy ?? ""] ?? "Blocked"}</Badge>
            </div>
            <p className="text-[13px] text-ink-muted wrap-anywhere">{p.vendor} · {p.model}</p>
            <p className="text-[13px] text-ink-faint">{p.residency}{p.hosts.length ? ` · host ${p.hosts.join(", ")}` : ""}</p>
            {p.reason && <p className="text-[13px] text-warn">{p.reason}</p>}
            {p.local && <p className="break-all text-[13px] text-ink-faint">File {p.local.file} · {p.local.size_bytes ? `${num((p.local.size_bytes / 1e9), 2)} GB` : "missing"} · {p.local.threads} CPU threads{p.local.sha256 ? ` · sha256 ${p.local.sha256.slice(0, 16)}…` : ""} · {p.local.network}</p>}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2 text-[13px]">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.allowed_providers.includes(p.key)} disabled={!editable || p.key === "deterministic"} onChange={(e) => change({ allowed_providers: e.target.checked ? [...s.allowed_providers, p.key] : s.allowed_providers.filter((k) => k !== p.key) })} />On allowlist</label>
              {p.foreign && <span className={p.keyConfigured ? "text-ok" : "text-ink-faint"}>{p.keyConfigured ? "Key configured in deployment" : "No key in this deployment"}</span>}
              <span className="ms-auto tabular text-ink-faint">{p.priceInPerM === null ? "Price not set" : p.priceInPerM === 0 ? "No per-token cost" : `USD ${p.priceInPerM} / ${p.priceOutPerM} per million tokens in / out`}</span>
            </div>
          </Panel>
        ))}
      </div>

      {usage && (
        <Panel>
          <PanelHeader eyebrow="Cost and usage" title="Model calls across all agents" />
          <div className="grid gap-4 p-4">
            <dl className="grid grid-cols-2 gap-4 tabular sm:grid-cols-5">
              {[["Model calls", totals.calls.toLocaleString("en-GB")], ["Served from cache", totals.cached.toLocaleString("en-GB")], ["Blocked by policy", totals.blocked.toLocaleString("en-GB")], ["Tokens", totals.tokens.toLocaleString("en-GB")], ["Spend", `USD ${num(totals.cost, 4)}`]].map(([k, v]) => <div key={k}><dt className="text-[13px] text-ink-faint">{k}</dt><dd className="text-[20px] font-medium">{v}</dd></div>)}
            </dl>
            <p className="text-[13px] text-ink-faint">Local model compute time: {num((totals.ms / 1000), 0)} s on this host. Foreign spend uses the provider price table above.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead><tr className="border-b border-line text-ink-faint">{["Agent", "Calls", "Blocked", "Tokens", "Time", "Cost"].map((h) => <th key={h} className="px-3 py-1.5 text-start font-medium">{h}</th>)}</tr></thead>
                <tbody>{usage.byAgent.map((a) => <tr key={a.agent_key} className="border-b border-line/50"><td className="px-3 py-1.5">{AGENT_LABEL[a.agent_key] ?? a.agent_key}</td><td className="px-3 py-1.5 tabular">{a.calls}</td><td className="px-3 py-1.5 tabular">{a.blocked}</td><td className="px-3 py-1.5 tabular">{(a.tokens ?? 0).toLocaleString("en-GB")}</td><td className="px-3 py-1.5 tabular">{num(((a.ms ?? 0) / 1000), 0)} s</td><td className="px-3 py-1.5 tabular">USD {num((a.cost_usd ?? 0), 4)}</td></tr>)}</tbody>
              </table>
            </div>
            {usage.recentBlocked.length > 0 && (
              <div><div className="mb-1 text-[13px] font-medium">Recent calls blocked by the controls</div>
                <ul className="grid gap-1 text-[13px]">{usage.recentBlocked.map((b, i) => <li key={i} className="flex flex-wrap gap-2"><Badge tone="warn">{b.provider}</Badge><span className="text-ink-muted">{AGENT_LABEL[b.agent_key] ?? b.agent_key} · {b.classification}</span><span className="text-ink-faint">{b.reason}</span><span className="ms-auto tabular text-ink-faint">{formatDate(b.created_at, true)}</span></li>)}</ul>
              </div>
            )}
            <div><div className="mb-1 text-[13px] font-medium">Recent agent runs</div>
              <ul className="grid gap-1 text-[13px]">{usage.runs.slice(0, 10).map((r) => <li key={r.id} className="flex flex-wrap gap-2"><Badge tone={r.status === "completed" ? "ok" : r.status === "failed" ? "crit" : "info"}>{r.status}</Badge><span>{r.kind.replace("_", " ")}{r.case_key ? ` · ${r.case_key}` : ""}</span>{r.question && <span className="max-w-[40ch] truncate text-ink-muted">“{r.question}”</span>}<span className="text-ink-faint">{r.model_calls} calls · USD {num(r.cost_usd, 4)} · {r.requested_by_label}</span><span className="ms-auto tabular text-ink-faint">{formatDate(r.started_at, true)}</span></li>)}</ul>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader eyebrow="Bounded agents" title="What each agent may and may not do" />
        <ul className="grid gap-3 p-4 md:grid-cols-2">
          {agents.map((a) => (
            <li key={a.key} className="rounded-md border border-line bg-surface-2 p-3 text-[13px]">
              <div className="font-medium text-ink">{a.name}</div>
              <p className="mt-0.5 text-ink-muted">{a.purpose}</p>
              <p className="mt-1 text-ink-faint">Tools: <span translate="no" className="font-mono text-[13px]">{a.tools.join(", ")}</span></p>
              <p className="mt-0.5"><span className="text-ok">May:</span> {a.may.join("; ")}. <span className="text-warn">May not:</span> {a.mayNot.join("; ")}.</p>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
