import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandCentreOriginal } from "@/components/command-centre-original";
import { sectorByKey } from "@/lib/command-centres";

/** Phase 1 sector Command Centres, exactly as the mockups: own shell, no OS data, every figure "—". Public, no sign-in. */
export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const s = sectorByKey((await params).sector);
  return { title: s ? `${s.title} (mockup version) · TIGERIS AI OS` : "Command Centre · TIGERIS AI OS" };
}

export default async function Page({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  if (!sectorByKey(sector)) notFound();
  return <CommandCentreOriginal sectorKey={sector} />;
}
