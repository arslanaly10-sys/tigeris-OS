"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { DISCLAIMER, ENGAGEMENT_FORMATS, INTAKE, WELCOME } from "@/content/client-copy";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useCan } from "./session-context";
import { DataLabel } from "./data-label";

/**
 * Briefing intake (brief v3 §7.1, module 1). The fields mirror tigercapital.ai/briefing exactly, plus one the client
 * form lacks: approximate AUM or budget under mandate, which feeds the value model. The client's sensitive-information
 * disclaimer is shown verbatim. Submitting creates an engagement and opens its Gap Report.
 */
const EMPTY = { fullName: "", title: "", email: "", phone: "", organisation: "", website: "", category: INTAKE.categories[0] as string, jurisdiction: INTAKE.jurisdictions[0] as string,
  interests: [] as string[], posture: INTAKE.postures[0] as string, challenge: "", window: INTAKE.windows[1] as string, format: INTAKE.formats[3] as string, aumBn: "" };
const FUND_B = { ...EMPTY, fullName: "Demo Principal (fictional)", title: "Chief Investment Officer", email: "cio@fund-b.example.invalid", organisation: "Fund B (synthetic)", category: "Sovereign Wealth Fund",
  jurisdiction: "Qatar", interests: ["Sovereign Capital Intelligence and Allocation", "Geopolitical Foresight and Scenario Simulation"], posture: "Strategic Capital Co-Investor",
  challenge: "Where is our coordination debt highest, and what would closing it be worth?", window: "30 days", format: "Secure Virtual Council", aumBn: "450" };

const STAGES = ["briefing", "workshop", "report", "blueprint", "pilot"] as const;

export function BriefingIntakeModule() {
  const can = useCan();
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [list, setList] = useState<Array<{ id: string; title: string; status: string; data_mode: string; organisation: string; created_at: string }> | null>(null);
  useEffect(() => { api<{ engagements: typeof list & object }>("/engagements").then((r) => r.ok && setList(r.data.engagements)); }, []);
  const field = "h-10 w-full border border-line bg-surface px-3 text-[14px]";
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="grid gap-1 text-[13px] text-ink-muted">{label}{children}</label>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const aum = Number(f.aumBn) * 1e9;
    const r = await api<{ engagementId: string }>("/engagements", { json: { ...f, aumBn: undefined, aumUsd: aum > 0 ? aum : null, phone: f.phone || undefined, website: f.website || undefined } });
    setBusy(false);
    if (r.ok) router.push(`/gap-report?e=${r.data.engagementId}`); else setMsg(r.message);
  }

  return (
    <>
      <PageHeader nav="nav.briefing" description="Private institutional briefing intake. The fields follow the client's briefing form; the stated challenge and areas of interest seed the diagnosis, and the approximate mandate feeds the value model." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader eyebrow={WELCOME.eyebrow} title="Request a private briefing"
            actions={can("diagnostic.run") && <Button size="sm" variant="ghost" type="button" onClick={() => setF(FUND_B)}><Sparkles />Fill a synthetic example</Button>} />
          <form onSubmit={submit} className="grid gap-6 p-5">
            <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="eyebrow mb-2">Executive identity</legend>
              <L label="Full name"><input required className={field} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></L>
              <L label="Official designation or title"><input required className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
              <L label="Institutional email"><input required type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></L>
              <L label="Direct telephone or Signal"><input className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></L>
            </fieldset>
            <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="eyebrow mb-2">Entity profile</legend>
              <L label="Official organization name"><input required className={field} value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} /></L>
              <L label="Institutional website"><input className={field} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></L>
              <L label="Institutional category"><select className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{INTAKE.categories.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L label="Jurisdiction"><select className={field} value={f.jurisdiction} onChange={(e) => setF({ ...f, jurisdiction: e.target.value })}>{INTAKE.jurisdictions.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L label="Approximate AUM or budget under mandate (US$ bn, optional)"><input inputMode="decimal" className={field} value={f.aumBn} onChange={(e) => setF({ ...f, aumBn: e.target.value })} /></L>
            </fieldset>
            <fieldset className="grid gap-2"><legend className="eyebrow mb-2">Strategic areas of interest</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">{INTAKE.interests.map((i) => (
                <label key={i} className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={f.interests.includes(i)} onChange={(e) => setF({ ...f, interests: e.target.checked ? [...f.interests, i] : f.interests.filter((x) => x !== i) })} />{i}</label>
              ))}</div>
            </fieldset>
            <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="eyebrow mb-2">Partnership posture and engagement</legend>
              <L label="Partnership posture"><select className={field} value={f.posture} onChange={(e) => setF({ ...f, posture: e.target.value })}>{INTAKE.postures.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L label="Engagement window"><select className={field} value={f.window} onChange={(e) => setF({ ...f, window: e.target.value })}>{INTAKE.windows.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L label="Format"><select className={field} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>{INTAKE.formats.map((c) => <option key={c}>{c}</option>)}</select></L>
              <div className="sm:col-span-2"><L label="Strategic priority or decision challenge"><textarea required minLength={10} rows={3} className="w-full border border-line bg-surface p-3 text-[14px]" value={f.challenge} onChange={(e) => setF({ ...f, challenge: e.target.value })} /></L></div>
            </fieldset>
            <p className="text-[13px] text-ink-faint">{DISCLAIMER}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" type="submit" disabled={busy || !can("diagnostic.run")}>{busy ? "Opening…" : "Open the engagement"}<ArrowRight className="rtl:rotate-180" /></Button>
              {!can("diagnostic.run") && <span className="text-[13px] text-ink-faint">Executives, analysts and domain experts open engagements.</span>}
              {msg && <span role="alert" className="text-[13px] text-warn">{msg}</span>}
            </div>
          </form>
        </Panel>
        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader eyebrow="Engagements" title="Briefing → workshop → report → blueprint → pilot" />
            {!list ? <div className="m-4 h-20 animate-pulse bg-surface-2" /> : (
              <ul className="grid">{list.map((e) => (
                <li key={e.id}><a href={`/gap-report?e=${e.id}`} className="grid gap-1 border-b border-line/60 px-4 py-3 hover:bg-surface-2">
                  <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{e.title}{e.data_mode === "synthetic" && <DataLabel kind="SYNTHETIC" />}</span>
                  <span className="flex flex-wrap gap-1">{STAGES.map((s) => <Badge key={s} tone={s === e.status ? "gold" : "neutral"}>{s}</Badge>)}</span>
                  <span className="text-[12.5px] text-ink-faint">{formatDate(e.created_at, true)}</span>
                </a></li>
              ))}</ul>
            )}
          </Panel>
          <Panel className="grid gap-3 p-4">
            {ENGAGEMENT_FORMATS.map((x) => <div key={x.title}><div className="font-serif text-[16px] font-semibold">{x.title}</div><p className="text-[13.5px] text-ink-muted">{x.text.charAt(0).toUpperCase() + x.text.slice(1)}</p></div>)}
          </Panel>
        </div>
      </div>
    </>
  );
}
