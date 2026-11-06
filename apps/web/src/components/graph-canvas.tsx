"use client";
import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import { usePrefs } from "./prefs";

export interface GNode { id: string; key: string; name: string; type: string; claim_class: string; depth?: number }
export interface GEdge { id: string; source: string; target: string; predicate: string; predicate_label: string; relationship_class: string }

/** Link styles carry the claim class in shape, not only colour (FR-15, accessibility). */
export const EDGE_STYLE: Record<string, { label: string; line: "solid" | "dashed" | "dotted"; token: string }> = {
  observed: { label: "Observed", line: "solid", token: "--ok" },
  sourced: { label: "Sourced", line: "solid", token: "--info" },
  inferred: { label: "Inferred", line: "dashed", token: "--warn" },
  assumed: { label: "Assumed", line: "dotted", token: "--ink-muted" },
  synthetic: { label: "Synthetic", line: "dashed", token: "--accent" },
};

const TYPE_SHAPE: Record<string, cytoscape.Css.NodeShape> = {
  chokepoint: "diamond", country: "round-rectangle", port: "ellipse", terminal: "ellipse", refinery: "hexagon", pipeline: "rectangle", field: "triangle",
  facility: "hexagon", desalination: "round-pentagon", power_plant: "round-pentagon", city: "round-rectangle", airport: "round-triangle",
  holding: "round-diamond", institution: "star", mandate: "tag", market: "barrel", route: "rectangle", commodity: "barrel", vessel: "vee", sanctions_regime: "octagon",
};

export function GraphCanvas({ nodes, edges, origin, onSelect, height = 520 }: { nodes: GNode[]; edges: GEdge[]; origin?: string; onSelect?: (key: string) => void; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const { theme } = usePrefs();

  useEffect(() => {
    if (!ref.current) return;
    const css = getComputedStyle(document.documentElement);
    const v = (t: string) => css.getPropertyValue(t).trim();
    cy.current?.destroy();
    cy.current = cytoscape({
      container: ref.current,
      elements: [
        ...nodes.map((n) => ({ data: { id: n.id, key: n.key, label: n.name.length > 30 ? `${n.name.slice(0, 28)}…` : n.name, type: n.type, claim: n.claim_class, origin: n.id === origin ? 1 : 0 } })),
        ...edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.predicate_label, cls: e.relationship_class } })),
      ],
      style: [
        { selector: "node", style: { "background-color": v("--surface-3"), "border-width": 1.5, "border-color": v("--line-strong"), label: "data(label)", color: v("--ink"), "font-size": 9, "text-valign": "bottom", "text-margin-y": 4, width: 18, height: 18, "font-family": "Inter Variable, Arial, sans-serif", "text-outline-width": 2, "text-outline-color": v("--bg"), shape: (el: cytoscape.NodeSingular) => TYPE_SHAPE[el.data("type")] ?? "ellipse" } as cytoscape.Css.Node },
        { selector: "node[claim = 'synthetic']", style: { "border-color": v("--accent"), "border-style": "dashed" } },
        { selector: "node[type = 'chokepoint']", style: { "background-color": v("--crit-soft"), "border-color": v("--crit"), width: 26, height: 26 } },
        { selector: "node[origin = 1]", style: { "background-color": v("--primary"), "border-color": v("--primary"), width: 30, height: 30, "font-weight": "bold" } },
        { selector: "edge", style: { width: 1.2, "curve-style": "bezier", "target-arrow-shape": "triangle", "arrow-scale": 0.7, opacity: 0.85 } },
        ...Object.entries(EDGE_STYLE).map(([cls, s]) => ({ selector: `edge[cls = '${cls}']`, style: { "line-color": v(s.token), "target-arrow-color": v(s.token), "line-style": s.line } })),
        { selector: "edge:selected, node:selected", style: { "overlay-opacity": 0.12, "overlay-color": v("--primary") } },
      ],
      wheelSensitivity: 0.2,
    });
    const layout = cy.current.layout({ name: "cose", animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 80, padding: 20 } as cytoscape.LayoutOptions);
    layout.run();
    cy.current.on("tap", "node", (e) => onSelect?.(e.target.data("key")));
    const instance = cy.current;
    return () => {
      // Stop the running layout before destroying, so its animation never touches a destroyed graph.
      layout.stop();
      instance.destroy();
      if (cy.current === instance) cy.current = null;
    };
  }, [nodes, edges, origin, onSelect, theme]);

  return <div ref={ref} style={{ height }} className="w-full rounded-md border border-line bg-bg" role="img" aria-label={`Graph of ${nodes.length} entities and ${edges.length} relationships. The same information is listed beside the graph.`} />;
}

export function EdgeLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted" aria-label="Link types">
      {Object.entries(EDGE_STYLE).map(([k, s]) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke={`var(${s.token})`} strokeWidth="2" strokeDasharray={s.line === "dashed" ? "5 3" : s.line === "dotted" ? "1.5 3" : undefined} /></svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}
