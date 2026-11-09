import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { BriefingScene } from "@/components/scenes/BriefingScene";
import { Badge } from "@/components/ui/badge";
import { DISCLAIMER, ENGAGEMENT_FORMATS, LOOP_LINE, PRINCIPLES, USE_CASES, WELCOME } from "@/content/client-copy";

export const metadata = { title: "Private Institutional Briefing · TIGERIS" };

/**
 * Welcome screen (brief v3 §13A, golden path step 0), in the client's Briefing look. All client copy is verbatim from
 * content/client-copy.ts. Each principle links to the part of the OS that demonstrates it; only use case 02 runs here.
 */
function Rule({ n, label }: { n: string; label: string }) {
  return (
    <div className="eyebrow flex items-center gap-3"><span className="tabular">{n}</span><span>·</span><span>{label}</span><span className="h-px flex-1 bg-[var(--line-strong)] opacity-50" /></div>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left,0px))] py-5 sm:px-10">
        <Wordmark />
        <Link href="/sign-in" className="tap text-[13px] font-medium text-accent hover:underline">Enter the prototype</Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] gap-16 px-4 pb-10 sm:px-10">
        <section className="grid gap-8">
          <h1 className="sr-only">{WELCOME.headline}</h1>
          {/* Scene 06: the client's briefing plate, live (docs/MOTION_SCENES.md). */}
          <div className="-mx-4 border-y border-line sm:-mx-10"><BriefingScene className="block h-auto w-full" /></div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="grid max-w-[64ch] gap-3 text-[16px] leading-relaxed text-ink-muted">{WELCOME.body.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
            <div className="flex flex-wrap content-start gap-3 lg:justify-end">
              <Link href="/sign-in" className="btn inline-flex h-11 items-center gap-2 rounded-[2px] bg-primary px-5 text-[14px] font-medium text-primary-ink hover:bg-primary-hover">Enter the prototype<ArrowRight className="size-4 rtl:rotate-180" /></Link>
              <Link href="/readiness" className="btn inline-flex h-11 items-center gap-2 rounded-[2px] border border-[var(--line-strong)] px-5 text-[14px] font-medium hover:bg-surface-2">Sovereign readiness check</Link>
            </div>
          </div>
          <p className="fig-caption">{LOOP_LINE.join(" · ")}</p>
        </section>

        <section className="grid gap-6">
          <Rule n="02" label="TIGERIS Principles" />
          <ol className="grid gap-px border border-line bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <li key={p.n} className="grid content-start gap-3 bg-bg p-6">
                <span className="eyebrow tabular">{p.n}</span>
                <h2 className="text-[20px] leading-tight">{p.title}</h2>
                <p className="text-[14px] leading-relaxed text-ink-muted">{p.text}</p>
                <Link href={p.proof.href} className="tap mt-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">See it in the OS: {p.proof.label}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6">
          <Rule n="03" label="Strategic Use Cases" />
          <ol className="grid gap-px border border-line bg-[var(--line)] md:grid-cols-5">
            {USE_CASES.map((u) => (
              <li key={u.n} className="grid content-start gap-3 bg-bg p-5">
                <span className="eyebrow tabular">Scenario {u.n}</span>
                <h3 className="font-serif text-[17px] font-semibold leading-snug">{u.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-ink-muted">{u.text}</p>
                <span className="mt-auto">{u.status === "live" ? <Badge tone="ok"><CheckCircle2 />Runs in this prototype</Badge> : <Badge><Clock3 />Available in pilot</Badge>}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6">
          <Rule n="04" label="Engagement formats" />
          <div className="grid gap-px border border-line bg-[var(--line)] md:grid-cols-2">
            {ENGAGEMENT_FORMATS.map((f) => (
              <div key={f.title} className="grid gap-2 bg-bg p-6"><h3 className="font-serif text-[18px] font-semibold">{f.title}</h3><p className="text-[14px] text-ink-muted">{f.text.charAt(0).toUpperCase() + f.text.slice(1)}</p></div>
            ))}
          </div>
          <p className="max-w-[90ch] text-[13px] text-ink-faint">{DISCLAIMER}</p>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-line px-[max(16px,env(safe-area-inset-left,0px))] py-5 sm:px-10">
        <span className="fig-caption">Confidential · Prototype</span>
        <span className="fig-caption">TIGERIS AI OS · Prototype · Fictional institutions and people</span>
      </footer>
    </div>
  );
}
