import { redirect } from "next/navigation";
import { getContext } from "@/lib/api-server";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (ctx.status === 401 || ctx.status === 403) redirect("/sign-in");
  if (!ctx.data) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <div className="max-w-md rounded-lg border border-crit/40 bg-crit-soft p-5 text-crit">
          <h1 className="text-xl font-semibold">The TIGERIS service is not reachable</h1>
          <p className="mt-2 text-[13px]">The web app could not reach the API. Start it with <code className="font-mono">pnpm dev</code>, then reload this page.</p>
        </div>
      </div>
    );
  }
  return <Shell context={ctx.data}>{children}</Shell>;
}
