/**
 * Map icons drawn on canvas (slice 2, 9 Nov 2026): top-down silhouettes that point north and are rotated by
 * the map to each mover's heading, plus symbols for infrastructure. Shape carries the type, so status and kind
 * never rely on colour alone (CLAUDE.md rule 11). Registered once per map with pixelRatio 2.
 */

export type ShipShape = "crude_tanker" | "product_tanker" | "lng_carrier" | "container" | "bulk_grain" | "tug" | "passenger" | "fishing" | "generic";
export type PlaneShape = "airliner_wide" | "airliner_narrow" | "freighter";
export type InfraShape = "ports" | "refineries" | "desal" | "power" | "airports" | "chokepoints";

const DARK = "#07101c";
const LIGHT = "#ece8de";

/** A square canvas centred on the origin; `scale` enlarges the drawing so icons stay legible on the map. */
function canvas(size: number, scale = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(size * scale);
  const g = c.getContext("2d")!;
  g.translate(c.width / 2, c.height / 2);
  g.scale(scale, scale);
  return { c, g, size: c.width };
}

/** A ship hull pointing up: sharp bow, straight sides, square stern. */
function hull(g: CanvasRenderingContext2D, L: number, B: number) {
  const top = -L / 2, bot = L / 2;
  g.beginPath();
  g.moveTo(0, top);
  g.quadraticCurveTo(B / 2, top + L * 0.16, B / 2, top + L * 0.32);
  g.lineTo(B / 2, bot - 1.5);
  g.quadraticCurveTo(B / 2, bot, B / 2 - 1.5, bot);
  g.lineTo(-B / 2 + 1.5, bot);
  g.quadraticCurveTo(-B / 2, bot, -B / 2, bot - 1.5);
  g.lineTo(-B / 2, top + L * 0.32);
  g.quadraticCurveTo(-B / 2, top + L * 0.16, 0, top);
  g.closePath();
}

const DIMS: Record<ShipShape, [number, number]> = {
  crude_tanker: [31, 11], product_tanker: [27, 10], lng_carrier: [30, 11], container: [31, 11], bulk_grain: [28, 11], tug: [16, 10], passenger: [27, 10], fishing: [15, 8], generic: [25, 10],
};

/**
 * A ship silhouette. `holding` draws it hollow (waiting at anchor), `rerouted` adds a dashed circle,
 * `observed` adds a solid ivory ring (a real ship from AIS rather than the simulation).
 */
export function shipImage(shape: ShipShape, color: string, opts: { holding?: boolean; rerouted?: boolean; observed?: boolean } = {}): ImageData {
  const { g, size } = canvas(40, 1.8);
  const [L, B] = DIMS[shape];
  hull(g, L, B);
  g.fillStyle = opts.holding ? "rgba(0,0,0,0)" : color;
  g.fill();
  g.lineWidth = opts.holding ? 1.6 : 1;
  g.strokeStyle = opts.holding ? color : DARK;
  g.stroke();
  if (!opts.holding) {
    g.save();
    hull(g, L, B);
    g.clip();
    const top = -L / 2, bot = L / 2;
    const shade = "rgba(7,16,28,0.55)";
    const pale = "rgba(236,232,222,0.9)";
    switch (shape) {
      case "crude_tanker":
      case "product_tanker":
        g.strokeStyle = shade; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, top + L * 0.22); g.lineTo(0, bot - L * 0.24); g.stroke();
        g.beginPath(); g.moveTo(-B * 0.32, top + L * 0.5); g.lineTo(B * 0.32, top + L * 0.5); g.stroke();
        g.fillStyle = pale; g.fillRect(-B / 2 + 1, bot - L * 0.18, B - 2, L * 0.12);
        break;
      case "lng_carrier":
        g.fillStyle = pale;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, top + L * 0.26 + i * L * 0.15, B * 0.36, 0, Math.PI * 2); g.fill(); }
        g.fillRect(-B / 2 + 1, bot - L * 0.12, B - 2, L * 0.08);
        break;
      case "container": {
        const bands = ["#d8645a", "#79a8de", "#e8b86a", "#45b88c", "#ece8de"];
        for (let i = 0; i < 5; i++) { g.fillStyle = bands[i % bands.length]!; g.fillRect(-B / 2 + 1.2, top + L * 0.24 + i * L * 0.11, B - 2.4, L * 0.09); }
        g.fillStyle = pale; g.fillRect(-B / 2 + 1, bot - L * 0.14, B - 2, L * 0.08);
        break;
      }
      case "bulk_grain":
        g.fillStyle = shade;
        for (let i = 0; i < 5; i++) g.fillRect(-B * 0.32, top + L * 0.22 + i * L * 0.12, B * 0.64, L * 0.08);
        g.fillStyle = pale; g.fillRect(-B / 2 + 1, bot - L * 0.14, B - 2, L * 0.08);
        break;
      case "tug":
        g.fillStyle = pale; g.fillRect(-B * 0.3, -L * 0.15, B * 0.6, L * 0.3);
        break;
      case "passenger":
        g.fillStyle = pale; g.fillRect(-B * 0.36, top + L * 0.28, B * 0.72, L * 0.6);
        g.fillStyle = shade; for (let i = 0; i < 5; i++) g.fillRect(-B * 0.36, top + L * 0.34 + i * L * 0.11, B * 0.72, 0.8);
        break;
      case "fishing":
        g.fillStyle = pale; g.fillRect(-B * 0.3, 0, B * 0.6, L * 0.25);
        break;
      default:
        g.fillStyle = pale; g.fillRect(-B / 2 + 1, bot - L * 0.18, B - 2, L * 0.1);
    }
    g.restore();
  }
  if (opts.rerouted) { g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.setLineDash([2.5, 2.5]); g.strokeStyle = color; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); }
  if (opts.observed) { g.beginPath(); g.arc(0, 0, 17.5, 0, Math.PI * 2); g.strokeStyle = LIGHT; g.lineWidth = 1.6; g.stroke(); }
  return g.getImageData(0, 0, size, size);
}

/** A truck from above: cab ahead of a long trailer. */
export function truckImage(color: string): ImageData {
  const { g, size } = canvas(28, 1.4);
  g.fillStyle = color; g.strokeStyle = DARK; g.lineWidth = 1;
  g.beginPath(); g.rect(-3.5, -4, 7, 14); g.fill(); g.stroke();
  g.fillStyle = LIGHT; g.beginPath(); g.rect(-3, -10, 6, 5); g.fill(); g.stroke();
  return g.getImageData(0, 0, size, size);
}

/** An aircraft from above: swept wings and tailplane. Wide-bodies are drawn larger; freighters have no windows band. */
export function planeImage(shape: PlaneShape, color: string, opts: { observed?: boolean } = {}): ImageData {
  const { g, size } = canvas(40, 1.5);
  const k = shape === "airliner_wide" ? 1.15 : shape === "freighter" ? 1.05 : 0.9;
  g.save();
  g.scale(k, k);
  g.fillStyle = color; g.strokeStyle = DARK; g.lineWidth = 0.9 / k;
  g.beginPath();
  g.moveTo(0, -14);
  g.quadraticCurveTo(2, -12, 2, -8);
  g.lineTo(2, -3); g.lineTo(13, 3); g.lineTo(13, 5); g.lineTo(2, 2.5);
  g.lineTo(2, 8); g.lineTo(5.5, 11); g.lineTo(5.5, 12.5); g.lineTo(0.8, 11.5);
  g.lineTo(0, 13);
  g.lineTo(-0.8, 11.5); g.lineTo(-5.5, 12.5); g.lineTo(-5.5, 11); g.lineTo(-2, 8);
  g.lineTo(-2, 2.5); g.lineTo(-13, 5); g.lineTo(-13, 3); g.lineTo(-2, -3);
  g.lineTo(-2, -8);
  g.quadraticCurveTo(-2, -12, 0, -14);
  g.closePath();
  g.fill(); g.stroke();
  if (shape !== "freighter") { g.strokeStyle = "rgba(7,16,28,0.5)"; g.lineWidth = 0.7 / k; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 7); g.stroke(); }
  g.restore();
  if (opts.observed) { g.beginPath(); g.arc(0, 0, 17.5, 0, Math.PI * 2); g.strokeStyle = LIGHT; g.lineWidth = 1.6; g.stroke(); }
  return g.getImageData(0, 0, size, size);
}

/** Infrastructure symbol: a dark disc with a coloured ring and glyph, so each kind reads by shape. */
export function infraImage(shape: InfraShape, color: string): ImageData {
  const { g, size } = canvas(28);
  if (shape === "chokepoints") {
    g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fillStyle = "rgba(216,100,90,0.18)"; g.fill(); g.strokeStyle = color; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.stroke();
    return g.getImageData(0, 0, size, size);
  }
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fillStyle = "rgba(7,16,28,0.92)"; g.fill(); g.strokeStyle = color; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.4; g.lineCap = "round"; g.lineJoin = "round";
  switch (shape) {
    case "ports": // anchor
      g.beginPath(); g.moveTo(0, -5.5); g.lineTo(0, 5); g.moveTo(-3, -3); g.lineTo(3, -3); g.stroke();
      g.beginPath(); g.arc(0, 0.5, 4.8, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.beginPath(); g.arc(0, -6.2, 1.2, 0, Math.PI * 2); g.stroke();
      break;
    case "refineries": // column and flare
      g.fillRect(-4, -1, 3, 6.5); g.fillRect(1, -4.5, 3, 10);
      g.beginPath(); g.moveTo(2.5, -5); g.quadraticCurveTo(5, -7.5, 2.5, -8.5); g.quadraticCurveTo(1.5, -7, 2.5, -5); g.fill();
      break;
    case "desal": // water drop
      g.beginPath(); g.moveTo(0, -6); g.bezierCurveTo(4.5, -1, 4.5, 4.5, 0, 5); g.bezierCurveTo(-4.5, 4.5, -4.5, -1, 0, -6); g.fill();
      break;
    case "power": // bolt
      g.beginPath(); g.moveTo(1.5, -6); g.lineTo(-3, 1); g.lineTo(0, 1); g.lineTo(-1.5, 6); g.lineTo(3, -1); g.lineTo(0, -1); g.closePath(); g.fill();
      break;
    case "airports": // small plane
      g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 5.5); g.moveTo(-5.5, 0.5); g.lineTo(0, -1.5); g.lineTo(5.5, 0.5); g.moveTo(-2.5, 5); g.lineTo(0, 4); g.lineTo(2.5, 5); g.stroke();
      break;
  }
  return g.getImageData(0, 0, size, size);
}

/** AIS category → silhouette. */
export const AIS_SHAPE: Record<string, ShipShape> = { tanker: "crude_tanker", cargo: "bulk_grain", passenger: "passenger", service: "tug", fishing: "fishing", other: "generic" };
