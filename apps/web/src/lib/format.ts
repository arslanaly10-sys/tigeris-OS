const nf = (d: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Formats a value with its unit. Western digits everywhere (Q018). */
export function formatValue(v: number | null | undefined, unit?: string | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const u = unit ?? "";
  if (u === "USD") {
    const a = Math.abs(v);
    if (a >= 1e12) return `$${nf(2).format(v / 1e12)} tn`;
    if (a >= 1e9) return `$${nf(1).format(v / 1e9)} bn`;
    if (a >= 1e6) return `$${nf(1).format(v / 1e6)} m`;
    return `$${nf(0).format(v)}`;
  }
  if (u === "people") return v >= 1e6 ? `${nf(2).format(v / 1e6)} m` : nf(0).format(v);
  if (u === "% of GDP") return `${nf(1).format(v)}% of GDP`;
  if (u.startsWith("%")) return `${nf(1).format(v)}%`;
  if (u === "thousand b/d") return `${nf(0).format(v)} kb/d`;
  if (u === "million b/d") return `${nf(1).format(v)} mb/d`;
  return `${nf(2).format(v)}${u ? ` ${u}` : ""}`;
}

export const formatDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Asia/Riyadh" })
    : "—";

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const humanize = (s: string) => {
  const t = s.replace(/[._]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
