"use client";
import { PageHeader } from "../page-header";
import { MovementMapLazy } from "../movement-map-lazy";

export function MapModule() {
  return (
    <>
      <PageHeader nav="nav.map" description="Ships, trucks, infrastructure and active signals across the GCC. Replay a day, follow the simulated live clock, or overlay a scenario. Select anything to see where it comes from." />
      <MovementMapLazy />
    </>
  );
}
