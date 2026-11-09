/**
 * Geometry for scene 06 (Briefing), in the 1920×1080 design space. Measured from the reference plate
 * (public/brand/plates/06-briefing.webp, 2000×1125, scaled by 0.96); replace with the exact values from
 * render_site.py when the plate sources arrive.
 */
export const VIEW = { w: 1920, h: 1080 } as const;
export const HORIZON = 739;
export const SUN = { cx: 1359, cy: 588, r: 175 } as const;

/** Buildings as [x, width, height above the horizon]. */
export const BUILDINGS: ReadonlyArray<readonly [number, number, number]> = [
  [760.0, 21.9, 8.9],
  [785.7, 21.9, 12.7],
  [814.2, 27.4, 11.1],
  [844.8, 13.7, 22.0],
  [861.8, 21.9, 33.0],
  [888.0, 33.4, 19.8],
  [928.0, 33.9, 37.3],
  [964.6, 9.8, 45.0],
  [977.8, 21.9, 51.6],
  [1003.5, 10.4, 48.8],
  [1021.6, 13.7, 43.4],
  [1039.1, 9.8, 22.0],
  [1052.7, 33.9, 67.4],
  [1090.5, 9.8, 35.1],
  [1104.7, 27.4, 22.0],
  [1137.0, 21.9, 81.1],
  [1161.6, 18.1, 51.0],
  [1183.0, 33.4, 31.9],
  [1219.6, 33.4, 78.4],
  [1261.8, 13.7, 29.1],
  [1279.8, 9.3, 68.5],
  [1297.9, 21.3, 75.6],
  [1326.3, 26.8, 29.1],
  [1357.5, 32.3, 61.4],
  [1394.7, 13.1, 83.8],
  [1412.3, 32.8, 83.3],
  [1449.5, 32.3, 219.0],
  [1491.1, 33.4, 60.3],
  [1527.7, 27.4, 46.1],
  [1558.4, 13.7, 27.5],
  [1578.1, 33.9, 35.7],
  [1620.7, 21.9, 16.0],
  [1648.1, 27.9, 18.7],
  [1680.4, 17.5, 22.0],
  [1704.5, 27.9, 18.7],
  [1738.4, 21.9, 23.7],
  [1764.1, 27.9, 8.9],
  [1795.3, 13.7, 8.9],
];

/** Engraved rings around the sun. */
export const RINGS = Array.from({ length: 20 }, (_, i) => SUN.r + 14 + i * 11);

/** Reflection lines under the horizon: [y, x-centre offset, half-width]. Wide at the top, narrowing downward. */
export const REFLECTIONS = Array.from({ length: 15 }, (_, i) => [HORIZON + 7 + i * 7.6, (i % 3) * 6 - 6, 175 - i * 10.5] as const);

export const TEXT = {
  lockup: { x: 72, y: 59, sub: 76 },
  pill: { x: 1650, y: 39, w: 198, h: 35, label: "Institutional Briefing" },
  headerRule: 104,
  section: { y: 152, ruleY: 148, ruleFrom: 566, ruleTo: 1848 },
  headline: { x: 117, size: 64, baselines: [331, 405, 479] },
  shortRule: { x1: 120, x2: 176, y: 540 },
  meta: { x: 120, y: 574 },
  footer: { y: 1028, x: 72, xEnd: 1848 },
} as const;
