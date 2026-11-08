import { Suspense } from "react";
import { CaseWorkspace } from "@/components/modules/cases";

export default async function CasePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <Suspense><CaseWorkspace caseKey={decodeURIComponent(key)} /></Suspense>;
}
