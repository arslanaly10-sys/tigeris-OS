"use client";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Charts follow the data-viz method: one y-axis, thin marks, 2px lines, a legend plus direct labels,
 * a hover crosshair with tooltip, a table view, and series that differ by line style as well as colour.
 * Series colours are the validated categorical slots 1–3 (--series-1..3).
 */
export interface Series { key: string; label: string; points: { x: number; y: number }[] }
const DASH = ["", "6 4", "2 3"];
const COLOR = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const span = max - min;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const err = (count / span) * step;
  const mult = err <= 0.15 ? 10 : err <= 0.35 ? 5 : err <= 0.75 ? 2 : 1;
  const s = step * mult;
  const out: number[] = [];
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function LineChart({ series, xLabel, yLabel, format, height = 260, markers }: { series: Series[]; xLabel: string; yLabel: string; format: (v: number) => string; height?: number; markers?: { x: number; label: string }[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 720;
  const H = height;
  const m = { l: 56, r: 96, t: 12, b: 34 };
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const rawMin = Math.min(...ys), rawMax = Math.max(...ys);
  const yMin = rawMin >= 0 && rawMin < rawMax * 0.4 ? 0 : rawMin - (rawMax - rawMin) * 0.08;
  const yMax = rawMax + (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.08;
  const sx = (x: number) => m.l + ((x - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
  const sy = (y: number) => m.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b);
  const yt = useMemo(() => niceTicks(yMin, yMax), [yMin, yMax]);
  const xt = useMemo(() => niceTicks(xMin, xMax, 6), [xMin, xMax]);
  const hoverX = hover !== null ? hover : null;
  const atX = (s: Series, x: number) => s.points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best), s.points[0]!);

  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const x = xMin + ((px - m.l) / (W - m.l - m.r)) * (xMax - xMin);
    setHover(Math.max(xMin, Math.min(xMax, Math.round(x))));
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted" aria-label="Legend">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={COLOR[i]} strokeWidth="2" strokeDasharray={DASH[i]} /></svg>{s.label}
            </li>
          ))}
        </ul>
        <button type="button" className="tap text-[13px] text-accent hover:underline" onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? "Show chart" : "Show table"}</button>
      </div>
      {!table ? (
        <div className="relative">
          <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={`${yLabel} by ${xLabel} for ${series.map((s) => s.label).join(", ")}. A table view is available.`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {yt.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth="1" />
                <text x={m.l - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--ink-faint)" className="tabular">{format(v)}</text>
              </g>
            ))}
            {xt.map((v) => <text key={v} x={sx(v)} y={H - m.b + 16} textAnchor="middle" fontSize="12" fill="var(--ink-faint)" className="tabular">{v}</text>)}
            <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--ink-muted)">{xLabel}</text>
            {markers?.map((mk) => mk.x >= xMin && mk.x <= xMax && (
              <g key={mk.label}>
                <line x1={sx(mk.x)} x2={sx(mk.x)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" strokeDasharray="3 3" />
                <text x={sx(mk.x) + 4} y={m.t + 10} fontSize="12" fill="var(--ink-muted)">{mk.label}</text>
              </g>
            ))}
            {series.map((s, i) => {
              const d = s.points.map((p, j) => `${j ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
              const last = s.points.at(-1)!;
              return (
                <g key={s.key}>
                  <path d={d} fill="none" stroke={COLOR[i]} strokeWidth="2" strokeDasharray={DASH[i]} strokeLinejoin="round" strokeLinecap="round" />
                  <text x={sx(last.x) + 6} y={sy(last.y) + (i - 1) * 11} dy="0.32em" fontSize="12" fill="var(--ink-muted)">{s.label}</text>
                </g>
              );
            })}
            {hoverX !== null && (
              <g pointerEvents="none">
                <line x1={sx(hoverX)} x2={sx(hoverX)} y1={m.t} y2={H - m.b} stroke="var(--ink-faint)" strokeWidth="1" />
                {series.map((s, i) => { const p = atX(s, hoverX); return <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={COLOR[i]} stroke="var(--surface)" strokeWidth="2" />; })}
              </g>
            )}
          </svg>
          {hoverX !== null && (
            <div className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-3 py-2 text-[13px] shadow-lg" style={{ [sx(hoverX) > W * 0.6 ? "right" : "left"]: `${sx(hoverX) > W * 0.6 ? 100 - (sx(hoverX) / W) * 100 + 2 : (sx(hoverX) / W) * 100 + 2}%` }}>
              <div className="mb-1 font-medium text-ink">{xLabel} {hoverX}</div>
              {series.map((s, i) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-ink-muted"><svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" stroke={COLOR[i]} strokeWidth="2" strokeDasharray={DASH[i]} /></svg>{s.label}</span>
                  <span className="tabular text-ink">{format(atX(s, hoverX).y)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-auto rounded-md border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-ink-faint"><th className="px-3 py-1.5 text-start font-medium">{xLabel}</th>{series.map((s) => <th key={s.key} className="px-3 py-1.5 text-end font-medium">{s.label}</th>)}</tr></thead>
            <tbody>
              {series[0]!.points.filter((_, i) => i % 5 === 0).map((p) => (
                <tr key={p.x} className="border-b border-line/50"><td className="px-3 py-1 tabular">{p.x}</td>{series.map((s) => <td key={s.key} className="px-3 py-1 text-end tabular">{format(atX(s, p.x).y)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[13px] text-ink-faint">{yLabel}</p>
    </div>
  );
}

/** P10–P90 range with the deterministic value marked; scaled within one row of comparable values. */
export function RangeBar({ value, p10, p90, min, max, index }: { value: number; p10: number | null; p90: number | null; min: number; max: number; index: number }) {
  const span = max - min || 1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / span) * 100))}%`;
  return (
    <div className="relative h-2.5 w-full rounded-sm bg-surface-3" aria-hidden="true">
      {p10 !== null && p90 !== null && <div className="absolute inset-y-0 rounded-sm opacity-45" style={{ left: pos(Math.min(p10, p90)), right: `calc(100% - ${pos(Math.max(p10, p90))})`, background: COLOR[index] }} />}
      <div className="absolute -top-0.5 h-3.5 w-[3px] rounded-sm" style={{ left: `calc(${pos(value)} - 1.5px)`, background: COLOR[index] }} />
    </div>
  );
}

/** Horizontal sensitivity bars around the baseline value (one series, so no legend). */
export function Tornado({ rows, base, format }: { rows: { label: string; low: number; high: number }[]; base: number; format: (v: number) => string }) {
  const vals = rows.flatMap((r) => [r.low, r.high]).concat(base);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pos = (v: number) => ((v - min) / span) * 100;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => {
        const lo = Math.min(r.low, r.high), hi = Math.max(r.low, r.high);
        return (
          <li key={r.label} className="grid grid-cols-[150px_1fr] items-center gap-3 text-[13px]" title={`${r.label}: ${format(r.low)} to ${format(r.high)}`}>
            <span className="truncate text-ink-muted">{r.label}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-[3px] rounded-[3px] bg-[var(--series-1)] opacity-70" style={{ left: `${pos(lo)}%`, width: `${Math.max(0.6, pos(hi) - pos(lo))}%` }} />
              <div className="absolute inset-y-0 w-px bg-ink-faint" style={{ left: `${pos(base)}%` }} />
            </div>
          </li>
        );
      })}
      <li className="grid grid-cols-[150px_1fr] gap-3 text-[13px] text-ink-faint"><span /><span className="flex justify-between tabular"><span>{format(min)}</span><span>baseline {format(base)}</span><span>{format(max)}</span></span></li>
    </ul>
  );
}

export const SERIES_COLOR = COLOR;
export const SERIES_DASH = DASH;
export function SeriesKey({ index, label, className }: { index: number; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5", className)}><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke={COLOR[index]} strokeWidth="2" strokeDasharray={DASH[index]} /></svg>{label}</span>;
}
