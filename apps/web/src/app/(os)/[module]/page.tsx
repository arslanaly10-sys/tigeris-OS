import { notFound } from "next/navigation";
import { moduleBySlug } from "@/lib/modules";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { CommandCentre } from "@/components/modules/command-centre";
import { GovernanceAudit } from "@/components/modules/governance-audit";
import { Administration } from "@/components/modules/administration";
import { About } from "@/components/modules/about";

const CUSTOM: Record<string, () => React.ReactNode> = {
  "command-centre": () => <CommandCentre />,
  governance: () => <GovernanceAudit />,
  administration: () => <Administration />,
  about: () => <About />,
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const def = moduleBySlug(module);
  if (!def) notFound();
  const custom = CUSTOM[module];
  return custom ? custom() : <ModulePlaceholder slug={module} />;
}
