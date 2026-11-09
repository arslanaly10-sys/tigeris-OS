"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, KeyRound, Landmark, Lock, ScrollText, Server, ShieldCheck, UserRound } from "lucide-react";
import { INDUSTRIES, ROLE_LABELS, jobTitle, type IndustryKey, type Role } from "@tigeris/shared";
import { IndustryIcon, industryName } from "@/components/industry";
import { api } from "@/lib/api";
import { usePrefs } from "@/components/prefs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BriefingScene } from "@/components/scenes/BriefingScene";
import { DOCTRINE } from "@/content/client-copy";
import { Badge } from "@/components/ui/badge";
import { Wordmark } from "@/components/wordmark";
import { PrefToggles } from "@/components/pref-toggles";
import { cn } from "@/lib/cn";

interface Person { id: string; name: string; title: string; role: Role; division: string }
interface Institution { id: string; name: string; shortName: string; buyerCategory: string; country: string; people: Person[] }
type Step = "institution" | "industry" | "method" | "idp" | "roles" | "mfa";

export default function SignInPage() {
  const { t, lang } = usePrefs();
  const router = useRouter();
  const [dir, setDir] = useState<Institution[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("institution");
  const [inst, setInst] = useState<Institution | null>(null);
  const [method, setMethod] = useState<"sso_simulated" | "demo_entry">("sso_simulated");
  const [person, setPerson] = useState<Person | null>(null);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const title = (r: Role) => jobTitle(industry, r, lang === "ar" ? "ar" : "en");
  const [demoCode, setDemoCode] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ institutions: Institution[] }>("/auth/demo-directory").then((r) => {
      if (r.ok) setDir(r.data.institutions);
      else setLoadError("The TIGERIS service is not reachable. Check that the API is running, then reload this page.");
    });
  }, []);

  async function choosePerson(p: Person) {
    if (!inst) return;
    setBusy(true);
    setError(null);
    const r = await api<{ demoMfaCode: string }>("/auth/sign-in", { json: { institutionId: inst.id, principalId: p.id, method, industry } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setPerson(p);
    setDemoCode(r.data.demoMfaCode);
    setCode(method === "demo_entry" ? r.data.demoMfaCode : "");
    setStep("mfa");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/auth/mfa", { json: { code } });
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    router.replace("/command-centre");
    router.refresh();
  }

  const back = () => {
    setError(null);
    setStep(step === "mfa" ? (method === "demo_entry" ? "roles" : "idp") : step === "idp" || step === "roles" ? "method" : step === "method" ? "industry" : "institution");
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
      {/* Brand side: the client's ivory briefing look, with scene 06 without its chrome. */}
      <aside className="relative hidden min-w-0 flex-col justify-between gap-8 border-e border-line px-12 py-10 lg:flex">
        <div className="relative"><Wordmark size="lg" /></div>
        <div className="relative max-w-xl space-y-5">
          <p className="eyebrow">Private Institutional Briefing · Sovereign Alignment</p>
          <p className="statement text-[52px] text-ink">{DOCTRINE}</p>
          <p className="max-w-[46ch] text-[16px] text-ink-muted">{t("product.tagline")} An institution-owned intelligence and decision layer: evidence is validated, linked and reasoned over, then put before a named person to decide.</p>
        </div>
        <BriefingScene chrome={false} className="block h-auto w-full" />
        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-muted">
          <li className="flex items-center gap-2"><Server className="size-4 text-accent" />{t("signin.sovereign")}</li>
          <li className="flex items-center gap-2"><Building2 className="size-4 text-accent" />{t("signin.onPrem")}</li>
          <li className="flex items-center gap-2"><ScrollText className="size-4 text-accent" />{t("signin.audited")}</li>
        </ul>
      </aside>

      {/* Access side */}
      <main className="flex min-w-0 flex-col px-[max(16px,env(safe-area-inset-left,0px))] py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="lg:hidden"><Wordmark /></div>
          <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
            <Badge tone="gold">{t("header.demo")}</Badge>
            <PrefToggles />
          </div>
        </div>

        <div className={cn("mx-auto flex w-full flex-1 flex-col justify-center gap-6 py-10", step === "industry" ? "max-w-[620px]" : "max-w-[440px]")}>
          <div className="space-y-1">
            {lang === "ar" && <Badge tone="info">{t("arabicDraft")}</Badge>}
            <h1 className="text-[28px] font-medium">{t("signin.title")}</h1>
            <p className="text-ink-muted">
              {step === "institution" && t("signin.chooseInstitution")}
              {step === "industry" && t("signin.chooseIndustry")}
              {step === "method" && <>{inst?.name} · {industryName(industry, lang === "ar" ? "ar" : "en")}</>}
              {step === "idp" && `${t("signin.idpTitle")} · ${t("signin.simulated")}`}
              {step === "roles" && t("signin.demoEntry")}
              {step === "mfa" && t("signin.mfaBody")}
            </p>
          </div>

          {loadError && <p role="alert" className="rounded-md border border-crit/40 bg-crit-soft p-3 text-crit">{loadError}</p>}
          {!dir && !loadError && <div className="h-40 animate-pulse rounded-lg bg-surface-2" aria-label="Loading institutions" />}

          {dir && step === "institution" && (
            <ul className="grid gap-3">
              {dir.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => { setInst(i); setStep("industry"); }}
                    className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-start transition-colors hover:border-primary"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-accent"><Landmark className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{i.name}</span>
                      <span className="block text-[13px] text-ink-muted">{i.buyerCategory} · {i.country} · fictional</span>
                    </span>
                    <ArrowRight className="size-4 text-ink-faint rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === "industry" && inst && (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("signin.industry")}>
              {INDUSTRIES.map((i) => (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => { setIndustry(i.key); setStep("method"); }}
                    className="flex h-full w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-start transition-colors hover:border-primary"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent"><IndustryIcon industry={i} className="size-[18px]" /></span>
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{lang === "ar" ? i.nameAr : i.name}</span>
                      <span className="block text-[13px] leading-snug text-ink-muted">{lang === "ar" ? i.focusAr : i.focus}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === "method" && inst && (
            <div className="grid gap-3">
              <Button size="lg" variant="primary" onClick={() => { setMethod("sso_simulated"); setStep("idp"); }}>
                <Landmark />{t("signin.sso")}<Badge tone="neutral" className="border-primary-ink/30 bg-transparent text-primary-ink">{t("signin.simulated")}</Badge>
              </Button>
              <Button size="lg" variant="secondary" onClick={() => { setMethod("demo_entry"); setStep("roles"); }}>
                <KeyRound />{t("signin.demoEntry")}
              </Button>
              <p className="text-[13px] text-ink-muted">
                Production sign-in federates to the institution&apos;s own identity provider with MFA. This build simulates both steps and stores no passwords.
              </p>
            </div>
          )}

          {(step === "idp" || step === "roles") && inst && (
            <div className="grid gap-2">
              {step === "idp" && (
                <div className="mb-1 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">
                  <Lock className="size-4 text-accent" /> idp.{inst.shortName.toLowerCase()}.example · {t("signin.choosePerson")}
                </div>
              )}
              <ul className={cn("grid gap-2", step === "roles" && "sm:grid-cols-2")}>
                {inst.people.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => choosePerson(p)}
                      className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-start transition-colors hover:border-primary disabled:opacity-60"
                    >
                      <UserRound className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="min-w-0">
                        {step === "roles" ? (
                          <>
                            <span className="block font-medium">{ROLE_LABELS[p.role]}</span>
                            {title(p.role) && <span className="block text-[13px] text-accent">{title(p.role)}</span>}
                            <span className="block text-[13px] text-ink-muted">{p.name}</span>
                          </>
                        ) : (
                          <>
                            <span className="block font-medium">{p.name}</span>
                            <span className="block text-[13px] text-ink-muted">{title(p.role) ?? p.title} · {ROLE_LABELS[p.role]}</span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "mfa" && person && (
            <form onSubmit={verify} className="grid gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <ShieldCheck className="size-5 text-ok" />
                <div className="min-w-0 text-[13px]">
                  <div className="font-medium text-ink">{person.name}</div>
                  <div className="text-ink-muted">{title(person.role) ?? ROLE_LABELS[person.role]} · {ROLE_LABELS[person.role]} · {inst?.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-ink-faint"><IndustryIcon industry={industry} className="size-3.5" />{industryName(industry, lang === "ar" ? "ar" : "en")}</div>
                </div>
              </div>
              <label htmlFor="mfa-code" className="grid gap-1.5">
                <span className="font-medium">{t("signin.mfaTitle")}</span>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 rounded-md border border-line bg-surface-2 px-3 font-mono text-[22px] text-ink tabular"
                  aria-describedby="mfa-demo"
                />
              </label>
              <div id="mfa-demo" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[13px] text-ink-muted">
                <span>{t("signin.demoCode")} ({t("signin.simulated")}): <span translate="no" className="font-mono text-ink tabular">{demoCode}</span></span>
                <button type="button" className="tap text-accent underline-offset-2 hover:underline" onClick={() => setCode(demoCode)}>{t("signin.useCode")}</button>
              </div>
              <Button type="submit" size="lg" variant="primary" disabled={busy || code.length !== 6}>{t("signin.verify")}</Button>
            </form>
          )}

          {error && <p role="alert" className="rounded-md border border-crit/40 bg-crit-soft p-3 text-[13px] text-crit">{error}</p>}

          {step !== "institution" && (
            <button type="button" onClick={back} className="flex items-center gap-1.5 self-start text-[13px] text-ink-muted hover:text-ink">
              <ArrowLeft className="size-4 rtl:rotate-180" />{t("signin.back")}
            </button>
          )}
        </div>

        <footer className="text-center text-[13px] text-ink-faint">{t("footer.notice")} · Demonstration build · Fictional institutions and people<span className="mt-1 block"><Link href="/readiness" className="tap text-accent hover:underline">Sovereign readiness check</Link> · <Link href="/trust" className="tap text-accent hover:underline">Trust and security</Link></span></footer>
      </main>
    </div>
  );
}
