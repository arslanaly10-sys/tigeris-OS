"use client";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ROLE_LABELS, type Role } from "@tigeris/shared";
import { api } from "@/lib/api";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";

interface Person { id: string; name: string; title: string; email: string; idp_issuer: string; division: string; role: Role }

export function Administration() {
  const [data, setData] = useState<{ people: Person[]; divisions: { id: string; name: string }[] } | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  useEffect(() => {
    api<{ people: Person[]; divisions: { id: string; name: string }[] }>("/admin/people").then((r) => (r.ok ? setData(r.data) : setDenied(r.message)));
  }, []);
  return (
    <>
      <PageHeader nav="nav.administration" description="People, roles and divisions for this institution. Identities come from the institution's identity provider; TIGERIS stores no passwords." />
      {denied && (
        <Panel className="flex items-start gap-3 border-crit/40 bg-crit-soft p-4 text-[13px] text-crit" role="alert">
          <ShieldAlert className="size-5 shrink-0" />
          <div><div className="font-semibold">Access refused</div><p>{denied} Switch to the Administrator role from the menu to manage this page.</p></div>
        </Panel>
      )}
      {!data && !denied && <div className="h-48 animate-pulse rounded-lg bg-surface-2" />}
      {data && (
        <div className="grid gap-5">
          <Panel>
            <PanelHeader eyebrow="Directory" title="People and roles" actions={<Badge className="tabular">{data.people.length} people · {data.divisions.length} divisions</Badge>} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead><tr className="border-b border-line text-ink-faint">{["Name", "Title", "Division", "Role", "Identity"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{p.title}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{p.division}</td>
                      <td className="px-4 py-2.5"><Badge tone="gold">{ROLE_LABELS[p.role]}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-faint">{p.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="text-[12px] text-ink-faint">Retention, export rules and model and source allowlists arrive in week 7.</p>
        </div>
      )}
    </>
  );
}
