import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandCentre } from "@/components/command-centre";
import { sectorByKey } from "@/lib/command-centres";


export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const s = sectorByKey((await params).sector);
  return { title: s ? `${s.title} · TIGERIS AI OS` : "Command Centre · TIGERIS AI OS" };
}

export default async function Page({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  if (!sectorByKey(sector)) notFound();
  return <CommandCentre sectorKey={sector} />;
}
