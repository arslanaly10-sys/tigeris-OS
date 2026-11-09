/**
 * Motion tokens for the TIGERIS scenes (docs/MOTION_SCENES.md §2). The ONLY place timing is defined.
 * Institutional, never playful: the site's ease, long calm loops, no overshoot.
 */
export const EASE = [0.22, 1, 0.36, 1] as const; // --ease-institutional
export const DUR = { color: 0.3, surface: 0.7 } as const; // --dur-color, --dur-surface

/** Spring for data changes only: high damping, no visible overshoot. */
export const DATA_SPRING = { type: "spring", stiffness: 90, damping: 26, mass: 1, bounce: 0 } as const;

/** Sibling stagger, 20–60 ms; `speed` > 1 plays faster. */
export const stagger = (i: number, step = 0.04, speed = 1) => (i * step) / speed;

/** An entry transition with the brand ease, scaled by presenter speed. */
export const enter = (duration: number, delay = 0, speed = 1) => ({ duration: duration / speed, delay: delay / speed, ease: EASE });

/** A calm ambient loop: long period, mirrored, offset phase so nothing pulses in unison. */
export const ambient = (period: number, phase = 0) => ({ duration: period, delay: phase, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const });
