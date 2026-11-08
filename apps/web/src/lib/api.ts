/** Client-side calls go through the same-origin /api proxy. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; message: string }> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
    headers: init?.json !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: body.error ?? "error", message: body.message ?? "The request failed. Check the connection to the TIGERIS server and try again." };
  return { ok: true, data: body as T };
}

export interface AuthContext {
  principal: { id: string; name: string; title: string; role: import("@tigeris/shared").Role };
  permissions: import("@tigeris/shared").Permission[];
  density: "spacious" | "dense";
  institution: { id: string; name: string; shortName: string; buyerCategory: string; country: string; residency: string; environment: string };
  dataMode: string;
  roleSwitch: { id: string; name: string; title: string; role: import("@tigeris/shared").Role }[];
}
