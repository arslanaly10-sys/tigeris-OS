"use client";
/**
 * GSAP (gsap.com, Standard "no charge" licence), bundled with the app like everything else: no CDN.
 * Motion (motion/react) stays the default for component state; GSAP is for sequenced entrances.
 * Every timeline goes through `gsap.matchMedia()` so reduced motion renders the final state at once.
 */
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export const REDUCED = "(prefers-reduced-motion: reduce)";
export const FULL = "(prefers-reduced-motion: no-preference)";

export { gsap, useGSAP };
