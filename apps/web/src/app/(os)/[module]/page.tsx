import { DecisionsModule } from "@/components/decisions-ui";
import { MemoryModule } from "@/components/memory-ui";
import { ArchitecturePage, ReportsModule } from "@/components/reports-ui";
import { notFound } from "next/navigation";
import { moduleBySlug } from "@/lib/modules";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { CommandCentre } from "@/components/modules/command-centre";
import { GovernanceAudit } from "@/components/modules/governance-audit";
import { Administration } from "@/components/modules/administration";
import { About } from "@/components/modules/about";
import { Suspense } from "react";
import { DataSources } from "@/components/modules/data-sources";
import { GraphModule } from "@/components/modules/graph";
import { SignalsModule } from "@/components/modules/signals";
import { CasesList } from "@/components/modules/cases";
import { DomainsModule } from "@/components/modules/domains";
import { MapModule } from "@/components/modules/map";
import { ScenariosModule } from "@/components/modules/scenarios-module";
import { SovereigntyModule } from "@/components/modules/sovereignty";
import { DiagnosticModule } from "@/components/diagnostic-ui";
import { PlaybooksModule } from "@/components/playbooks-ui";
import { FundModule } from "@/components/fund-ui";

const CUSTOM: Record<string, () => React.ReactNode> = {
  "command-centre": () => <CommandCentre />,
  governance: () => <GovernanceAudit />,
  administration: () => <Administration />,
  about: () => <About />,
  sources: () => <DataSources />,
  graph: () => <Suspense><GraphModule /></Suspense>,
  signals: () => <Suspense><SignalsModule /></Suspense>,
  cases: () => <CasesList />,
  domains: () => <DomainsModule />,
  map: () => <MapModule />,
  scenarios: () => <ScenariosModule />,
  decisions: () => <DecisionsModule />,
  memory: () => <MemoryModule />,
  reports: () => <ReportsModule />,
  architecture: () => <ArchitecturePage />,
  sovereignty: () => <Suspense><SovereigntyModule /></Suspense>,
  diagnostic: () => <Suspense><DiagnosticModule /></Suspense>,
  playbooks: () => <Suspense><PlaybooksModule /></Suspense>,
  fund: () => <Suspense><FundModule /></Suspense>,
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const def = moduleBySlug(module);
  if (!def) notFound();
  const custom = CUSTOM[module];
  return custom ? custom() : <ModulePlaceholder slug={module} />;
}
