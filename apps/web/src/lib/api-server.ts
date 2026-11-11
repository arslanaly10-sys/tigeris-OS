import "server-only";
import { cookies } from "next/headers";
import type { AuthContext } from "./api";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** Server components call the API directly, forwarding the session cookie. */
export async function serverApi<T>(path: string): Promise<{ status: number; data?: T }> {
  const jar = await cookies();
  const session = jar.get("tigeris_session")?.value;
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(session ? { cookie: `tigeris_session=${session}` } : {}), ...(process.env.TIGERIS_SHARED_KEY ? { "x-tigeris-key": process.env.TIGERIS_SHARED_KEY } : {}) },
    cache: "no-store",
  }).catch(() => undefined);
  if (!res) return { status: 503 };
  if (!res.ok) return { status: res.status };
  return { status: res.status, data: (await res.json()) as T };
}

export const getContext = () => serverApi<AuthContext>("/auth/context");
