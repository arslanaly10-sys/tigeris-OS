import { CaseWorkspace } from "@/components/modules/cases";

export default async function CasePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <CaseWorkspace caseKey={decodeURIComponent(key)} />;
}
