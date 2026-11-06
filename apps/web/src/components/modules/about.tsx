"use client";
import { usePrefs } from "../prefs";
import { PageHeader } from "../page-header";
import { Panel } from "../ui/panel";

const DOES = [
  "Connects approved evidence from public, licensed and institutional sources, with its origin, time and version kept.",
  "Validates sources and quarantines weak, stale or conflicting material before it can influence analysis.",
  "Links evidence into a shared intelligence graph and traces direct, second- and third-order effects.",
  "Compares scenarios over 72 hours, 90 days, one year and five years, with every number traceable to a source or a stated assumption.",
  "Puts ranked options before a named person, with the policy result and the authority required. Nothing executes without a human decision.",
  "Keeps each institution's data, graph, policies and memory inside its own boundary, and keeps working when foreign model access is cut.",
];
const DOES_NOT = [
  "It is not a dashboard, a chatbot, a portfolio system or a shared SaaS service.",
  "This build does not use client data, live licensed feeds or real customer identities.",
  "It makes no claim of predictive accuracy. Back-test results are shown only once measured.",
];

export function About() {
  const { t } = usePrefs();
  return (
    <>
      <PageHeader nav="nav.about" description={t("product.descriptor")} />
      <div className="geo-pattern rounded-lg border border-line bg-surface px-6 py-10 sm:px-10">
        <p className="eyebrow text-accent">TIGERIS</p>
        <p className="mt-3 max-w-[30ch] font-serif text-[30px] leading-tight">{t("product.tagline")}</p>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-[18px] font-semibold">What it does</h2>
          <ul className="mt-3 grid gap-2.5 text-[14px] text-ink">{DOES.map((d) => <li key={d}>{d}</li>)}</ul>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-[18px] font-semibold">What this demonstration does not claim</h2>
          <ul className="mt-3 grid gap-2.5 text-[14px] text-ink">{DOES_NOT.map((d) => <li key={d}>{d}</li>)}</ul>
          <p className="mt-4 text-[12px] text-ink-faint">Institutions and people in this build are fictional. Target institutions are referred to by buyer category only.</p>
        </Panel>
      </div>
    </>
  );
}
