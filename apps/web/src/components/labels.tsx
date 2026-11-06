import { AlertTriangle, Ban, CheckCircle2, CircleDashed, ShieldAlert } from "lucide-react";
import { Badge } from "./ui/badge";

const CLAIM: Record<string, { label: string; tone: "ok" | "info" | "warn" | "gold" | "neutral" }> = {
  observed: { label: "OBSERVED", tone: "ok" },
  sourced: { label: "SOURCED", tone: "info" },
  inferred: { label: "INFERRED", tone: "warn" },
  assumed: { label: "ASSUMPTION", tone: "neutral" },
  synthetic: { label: "SYNTHETIC", tone: "gold" },
  illustrative: { label: "ILLUSTRATIVE", tone: "gold" },
};

/** Persistent claim badges (FD §6). */
export function ClaimBadge({ claim }: { claim: string }) {
  const c = CLAIM[claim] ?? { label: claim.toUpperCase(), tone: "neutral" as const };
  return <Badge tone={c.tone} className="font-mono tracking-wide">{c.label}</Badge>;
}

const STATE: Record<string, { label: string; tone: "ok" | "warn" | "crit" | "neutral"; icon: React.ReactNode }> = {
  accepted: { label: "Accepted", tone: "ok", icon: <CheckCircle2 /> },
  warning: { label: "Accepted with warning", tone: "warn", icon: <AlertTriangle /> },
  quarantined: { label: "Quarantined", tone: "crit", icon: <ShieldAlert /> },
  rejected: { label: "Rejected", tone: "crit", icon: <Ban /> },
};

export function ValidationBadge({ state }: { state: string }) {
  const s = STATE[state] ?? { label: state, tone: "neutral" as const, icon: <CircleDashed /> };
  return <Badge tone={s.tone}>{s.icon}{s.label}</Badge>;
}

const SOURCE_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "crit" | "neutral" }> = {
  approved: { label: "Approved", tone: "ok" },
  pending_review: { label: "Pending review", tone: "warn" },
  unreachable: { label: "Unreachable", tone: "crit" },
  suspended: { label: "Suspended", tone: "neutral" },
};

export function SourceStatusBadge({ status }: { status: string }) {
  const s = SOURCE_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function CheckIcon({ result }: { result: string }) {
  if (result === "pass") return <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="Passed" />;
  if (result === "warn") return <AlertTriangle className="size-4 shrink-0 text-warn" aria-label="Warning" />;
  return <ShieldAlert className="size-4 shrink-0 text-crit" aria-label="Failed" />;
}
