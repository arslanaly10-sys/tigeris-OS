/**
 * Scene 03 geometry (docs/MOTION_SCENES.md §5, 03). Illustrative: no plate was supplied, so this is a drafted
 * stylisation of a Gulf-to-ocean strait in the scenes' 2000×1125 plate space, not a survey projection.
 * Keep `project` here so a real projection can replace it without touching the scene.
 */
export const BOUNDS = { west: 54.0, east: 58.6, south: 24.4, north: 27.4 } as const;
export const VIEW = { x0: 140, x1: 1860, y0: 230, y1: 960 } as const;

/** Equirectangular stand-in: lon/lat inside BOUNDS to plate pixels. */
export function project(lat: number, lon: number): [number, number] {
  const x = VIEW.x0 + ((lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * (VIEW.x1 - VIEW.x0);
  const y = VIEW.y0 + ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * (VIEW.y1 - VIEW.y0);
  return [x, y];
}

/** Coastlines (drafted): northern shore across the top, southern shore with a peninsula pushing up into the strait. */
export const NORTH_COAST = "M140 330C330 300 520 352 700 336C860 322 960 300 1040 340C1110 376 1160 420 1240 410C1360 396 1470 360 1600 372C1700 382 1790 360 1860 350";
export const SOUTH_COAST = "M140 760C300 742 470 770 640 720C760 684 860 640 950 600C1010 572 1050 520 1090 496C1112 484 1126 500 1120 532C1110 590 1150 640 1210 680C1320 750 1470 790 1600 830C1710 864 1790 900 1860 920";
export const NORTH_LAND = `${NORTH_COAST}L1860 230L140 230Z`;
export const SOUTH_LAND = `${SOUTH_COAST}L1860 960L140 960Z`;

/** The strait: the narrowest gap between the two shores. */
export const STRAIT = { x: 1110, y: 452, r: 46 } as const;

/** Shipping tracks, west to east, all passing the strait. Inbound tracks are reversed at render time. */
export const TRACKS = [
  "M190 560C420 540 640 520 820 480C930 456 1020 430 1100 438C1190 446 1260 500 1380 560C1520 630 1680 700 1840 760",
  "M200 610C430 600 660 560 840 500C950 466 1040 446 1112 452C1200 460 1280 520 1400 590C1540 670 1700 740 1840 800",
  "M220 500C450 470 650 460 830 440C950 428 1040 420 1104 426C1180 432 1250 470 1360 520C1500 584 1680 640 1840 690",
  "M180 650C380 640 600 610 800 540C930 494 1040 462 1118 464C1210 468 1300 540 1420 620C1560 712 1700 790 1840 850",
] as const;
