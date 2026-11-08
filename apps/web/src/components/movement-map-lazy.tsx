"use client";
import dynamic from "next/dynamic";

/** The map uses WebGL and window, so it renders only in the browser. */
export const MovementMapLazy = dynamic(() => import("./movement-map").then((m) => m.MovementMap), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-lg bg-surface-2" aria-label="Loading map" />,
});
