import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Clock3, KeyRound, Layers3, ScrollText, ServerOff, ShieldCheck, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export const metadata = { title: "Trust and security · TIGERIS" };

/**
 * Public trust page: how TIGERIS is deployed and controlled, stated as it is today. Working controls are
 * marked "In this build"; certifications not yet held are marked "Planned" (rule 9: never overstated).
 */
const CONTROLS: { Icon: LucideIcon; title: string; body: string; status: "built" | "planned" }[] = [
  { Icon: Building2, title: "Deployment options", body: "Runs in the institution's own data centre, its in-country cloud, or a fully isolated network. The same signed package installs from a folder with no internet access.", status: "built" },
  { Icon: ServerOff, title: "Outbound off by default", body: "The product makes no outbound calls. Outside data arrives only as signed packages carried across the boundary and checked before import.", status: "built" },
  { Icon: KeyRound, title: "Data sovereignty", body: "Data, models and keys stay with the institution. Each institution's records are isolated by forced row-level security; nothing trains on client data.", status: "built" },
  { Icon: Layers3, title: "Model independence", body: "Every model call passes one gateway: allowlist, classification ceiling, foreign-model switch and egress rule. The local open-weight model is the default; no provider lock-in.", status: "built" },
  { Icon: ScrollText, title: "Access and accountability", body: "Least-privilege roles checked on every request. Every change, refusal and export is written to a hash-chained, append-only audit trail that anyone with the auditor role can verify.", status: "built" },
  { Icon: ShieldCheck, title: "Certification and testing", body: "SOC 2 Type II and ISO 27001, and an independent penetration test, are planned for the pilot phase. They are not held today.", status: "planned" },
];

export default function TrustPage() {
  return (
    <div className="min-h-full bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[max(16px,env(safe-area-inset-left,0px))] py-4 sm:px-8">
        <Wordmark />
        <Link href="/readiness" className="tap text-[13px] text-accent hover:underline">Sovereign readiness check</Link>
      </header>
      <main className="mx-auto grid w-full max-w-[1100px] gap-6 px-4 py-8 sm:px-8">
        <section className="grid gap-3">
          <p className="eyebrow text-accent">Trust and security</p>
          <h1 className="max-w-[26ch] text-[34px] font-medium leading-tight">Sovereign by construction, not by contract.</h1>
          <p className="max-w-[60ch] text-[16px] text-ink-muted">TIGERIS is built to run inside the institution's boundary, with the institution holding the data, the models and the keys. This page says what is in place today and what is planned, without rounding up.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTROLS.map((c) => (
            <Panel key={c.title} className="grid gap-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[16px] font-medium"><c.Icon className="size-5 text-accent" />{c.title}</span>
                {c.status === "built" ? <Badge tone="ok"><CheckCircle2 />In this build</Badge> : <Badge><Clock3 />Planned</Badge>}
              </div>
              <p className="text-[14px] text-ink-muted">{c.body}</p>
            </Panel>
          ))}
        </div>
        <Panel className="grid gap-3 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-[18px] font-medium">Security documentation and briefing</h2>
            <p className="mt-1 max-w-[60ch] text-[14px] text-ink-muted">The architecture, data-flow and control descriptions, the live security posture checks and the audit-chain verification are shown in a security briefing for your team.</p>
          </div>
          <Button variant="primary" asChild><a href="https://tigercapital.ai/" rel="noreferrer">Request a security briefing<ArrowRight className="rtl:rotate-180" /></a></Button>
        </Panel>
      </main>
    </div>
  );
}
