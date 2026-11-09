"use client";
import { useEffect, useRef } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Panel } from "./ui/panel";
import { Badge } from "./ui/badge";
import { usePrefs } from "./prefs";

/**
 * Two pictures of the institutional context layer (after the pattern Ali shared from V7's context-graph page,
 * drawn in TIGERIS's own style and words): where an institution's memory sits today, and the one governed
 * context layer TIGERIS puts under its people and its agents. Connectors are marked built or planned, honestly.
 */

const SCATTERED = [
  "Board papers", "IC memos", "Email threads", "Data rooms", "Meeting notes", "Chat groups", "Spreadsheets", "Consultant reports",
  "Shared drives", "Policy manuals", "Risk reports", "Treasury files", "Terminal screens", "CRM notes", "Departed experts", "Handover notes",
  "Mandate letters", "Ministry letters", "Committee minutes", "Personal folders",
];
const SCATTERED_AR = [
  "أوراق المجلس", "مذكرات الاستثمار", "سلاسل البريد", "غرف البيانات", "محاضر الاجتماعات", "مجموعات الدردشة", "جداول البيانات", "تقارير الاستشاريين",
  "المجلدات المشتركة", "أدلة السياسات", "تقارير المخاطر", "ملفات الخزينة", "شاشات المنصات", "ملاحظات العملاء", "خبراء غادروا", "مذكرات التسليم",
  "خطابات التفويض", "خطابات الوزارات", "محاضر اللجان", "مجلدات شخصية",
];

/** A half ring of the places institutional knowledge lives today, around the problem statement. */
export function ScatteredMemory() {
  const { lang } = usePrefs();
  const ar = lang === "ar";
  const labels = ar ? SCATTERED_AR : SCATTERED;
  const cx = 500, cy = 360, r = 280;
  return (
    <Panel className="relative overflow-hidden">
      <svg viewBox="0 -90 1000 470" className="mx-auto block w-full max-w-[1000px]" style={{ direction: "ltr" }} role="img" aria-label={ar ? "المعرفة المؤسسية موزعة على أماكن كثيرة" : `Institutional knowledge is spread across ${labels.length} places: ${labels.join(", ")}.`}>
        {labels.map((t, i) => {
          const a = Math.PI + (Math.PI * (i + 0.5)) / labels.length;
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          const deg = (a * 180) / Math.PI;
          const flip = deg > 270;
          return (
            <g key={t} className="sm-label" style={{ animationDelay: `${(i % 7) * 0.45}s` }}>
              <circle cx={cx + (r - 18) * Math.cos(a)} cy={cy + (r - 18) * Math.sin(a)} r="2.5" fill={i % 4 === 0 ? "var(--primary)" : "var(--ink-faint)"} />
              <text x={x} y={y} fontSize="14" fill="var(--ink-muted)" textAnchor={flip ? "start" : "end"} dominantBaseline="middle"
                transform={`rotate(${flip ? deg - 360 : deg - 180} ${x} ${y})`}>{t}</text>
            </g>
          );
        })}
      </svg>
      <div className="px-6 pb-6 text-center sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-5 sm:pb-0">
        <p className="text-[22px] font-medium leading-tight sm:text-[26px]">{ar ? "ذاكرة مؤسستك موزعة" : "Your institution's memory is scattered"}</p>
        <p className="text-[17px] leading-tight text-ink-muted sm:text-[20px]">{ar ? "بين صناديق البريد والأنظمة وعقول الأفراد." : "across inboxes, systems and people's heads."}</p>
        <p className="mx-auto mt-3 max-w-[46ch] text-[14px] text-ink-faint">{ar ? "تيجيرس يجمعها في ذاكرة واحدة محكومة: كل قرار وسابقة ودليل، قابلة للبحث بالمعنى، مع مصدرها." : "TIGERIS gathers it into one governed memory: every decision, precedent and piece of evidence, searchable by meaning, with its source."}</p>
      </div>
    </Panel>
  );
}

interface Connector { label: string; labelAr: string; note: string; noteAr: string; built: boolean }
const INPUTS: Connector[] = [
  { label: "Signed public data packages", labelAr: "حزم البيانات العامة الموقعة", note: "Built: imported through the air gap", noteAr: "مبني: يُستورد عبر الفجوة الهوائية", built: true },
  { label: "Documents and filings", labelAr: "الوثائق والإفصاحات", note: "Built: upload with injection screening", noteAr: "مبني: رفع مع فحص الحقن", built: true },
  { label: "Data rooms and IC memos", labelAr: "غرف البيانات ومذكرات الاستثمار", note: "Upload today; data-room connector planned", noteAr: "الرفع متاح اليوم؛ موصل غرف البيانات مخطط", built: false },
  { label: "AIS and flight snapshots", labelAr: "لقطات السفن والطائرات", note: "Built: signed snapshots", noteAr: "مبني: لقطات موقعة", built: true },
  { label: "Email, calendar and chat", labelAr: "البريد والتقويم والدردشة", note: "Planned connector", noteAr: "موصل مخطط", built: false },
  { label: "Bloomberg, Aladdin, CRM", labelAr: "بلومبرغ وعلاء الدين وإدارة العملاء", note: "Planned; needs the institution's licences", noteAr: "مخطط؛ يتطلب تراخيص المؤسسة", built: false },
];
const OUTPUTS: Connector[] = [
  { label: "Cases and named decisions", labelAr: "الحالات والقرارات المسماة", note: "Built", noteAr: "مبني", built: true },
  { label: "Bounded agents", labelAr: "وكلاء محدودون", note: "Built: numbers from tools only", noteAr: "مبني: الأرقام من الأدوات فقط", built: true },
  { label: "Ask TIGERIS, with citations", labelAr: "اسأل تيجيرس مع الاستشهادات", note: "Built", noteAr: "مبني", built: true },
  { label: "Playbooks and scenarios", labelAr: "أدلة التشغيل والسيناريوهات", note: "Built", noteAr: "مبني", built: true },
  { label: "Reports and exports", labelAr: "التقارير والتصدير", note: "Built: redacted, audited", noteAr: "مبني: منقح ومدقق", built: true },
  { label: "MCP and API access", labelAr: "الوصول عبر MCP وواجهة البرمجة", note: "Planned: same governance and audit", noteAr: "مخطط: الحوكمة والتدقيق نفسها", built: false },
];

/** A slowly turning sphere of points: the institution's context graph, rendered on canvas. */
function Sphere() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const N = 1100;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
      return [rr * Math.cos(th), y, rr * Math.sin(th)] as const;
    });
    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue("--ink-muted").trim() || "#a4aebd";
    const gold = css.getPropertyValue("--primary").trim() || "#c8a35a";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, angle = 0.6, visible = true, last = performance.now();
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.46, cx = w / 2, cy = h / 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      for (let i = 0; i < N; i++) {
        const [x, y, z] = pts[i]!;
        const xr = x * c + z * s, zr = -x * s + z * c;
        const depth = (zr + 1) / 2;
        ctx.globalAlpha = 0.12 + depth * 0.55;
        ctx.fillStyle = i % 37 === 0 ? gold : ink;
        ctx.beginPath(); ctx.arc(cx + xr * R, cy + y * R, 0.6 + depth * 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t: number) => {
      angle += ((t - last) / 1000) * 0.12; last = t;
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(canvas);
    draw();
    if (!reduce) raf = requestAnimationFrame(loop);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

function ConnectorList({ items, side, ar }: { items: Connector[]; side: "in" | "out"; ar: boolean }) {
  return (
    <ul className="grid content-center gap-3">
      {items.map((c) => (
        <li key={c.label} className={side === "in" ? "lg:text-end" : ""}>
          <span className={`flex items-center gap-2 ${side === "in" ? "lg:flex-row-reverse" : ""}`}>
            <span className={`size-1.5 shrink-0 rounded-full ${c.built ? "bg-primary" : "bg-ink-faint"}`} />
            <span className="text-[14px] font-medium">{ar ? c.labelAr : c.label}</span>
          </span>
          <span className={`mt-0.5 flex items-center gap-1 text-[13px] text-ink-faint ${side === "in" ? "lg:justify-end" : ""}`}>
            {c.built ? <CheckCircle2 className="size-3.5 text-ok" /> : <Clock3 className="size-3.5" />}{ar ? c.noteAr : c.note}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One context layer for the institution's people and its agents. */
export function ContextLayer() {
  const { lang } = usePrefs();
  const ar = lang === "ar";
  return (
    <Panel className="p-6">
      <div className="text-center">
        <p className="text-[14px] text-ink-muted">{ar ? "طبقة سياق واحدة" : "One context layer"}</p>
        <h2 className="text-[26px] font-medium leading-tight sm:text-[30px]">{ar ? "لفرقك ولوكلائك" : "For your teams and your agents"}</h2>
        <p className="mx-auto mt-2 max-w-[56ch] text-[14px] text-ink-muted">{ar ? "كل ما تعرفه المؤسسة في رسم واحد محكوم، تعمل منه الفرق والوكلاء على السياق نفسه." : "Everything the institution knows in one governed graph. People and bounded agents work from the same context, with lineage on every fact and the same rules for both."}</p>
      </div>
      <div className="mt-6 grid items-center gap-6 lg:grid-cols-[1fr_minmax(280px,420px)_1fr]">
        <ConnectorList items={INPUTS} side="in" ar={ar} />
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
          <Sphere />
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-lg border border-primary/60 bg-surface/90 px-5 py-4 text-center shadow-[var(--overlay-shadow)] backdrop-blur">
              <div className="text-[15px] font-medium">{ar ? "رسم السياق المؤسسي" : "Institutional context graph"}</div>
              <div className="text-[13px] text-ink-faint">{ar ? "محكوم بواسطة تيجيرس" : "governed by TIGERIS"}</div>
            </div>
          </div>
        </div>
        <ConnectorList items={OUTPUTS} side="out" ar={ar} />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-[13px]">
        <Badge tone="ok"><CheckCircle2 />{ar ? "مبني" : "Built in this version"}</Badge>
        <Badge><Clock3 />{ar ? "مخطط" : "Planned"}</Badge>
      </div>
    </Panel>
  );
}
