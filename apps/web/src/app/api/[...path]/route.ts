import type { NextRequest } from "next/server";

/**
 * Same-origin proxy to the TIGERIS API (replaces the old /api rewrite). The browser only ever talks to this origin, so the
 * session cookie never crosses origins; on hosted deployments the proxy adds the shared key the API requires.
 */
export const dynamic = "force-dynamic";
const API_URL = process.env.API_URL ?? "http://localhost:4000";
const KEY = process.env.TIGERIS_SHARED_KEY ?? "";
const HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "content-length", "content-encoding"]);

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${API_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((v, k) => { if (!HOP.has(k.toLowerCase())) headers.set(k, v); });
  if (KEY) headers.set("x-tigeris-key", KEY);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(url, { method: req.method, headers, body: hasBody ? await req.arrayBuffer() : undefined, redirect: "manual", cache: "no-store" }).catch(() => null);
  if (!res) return Response.json({ error: "unreachable", message: "The TIGERIS service is not reachable." }, { status: 503 });
  const out = new Headers();
  res.headers.forEach((v, k) => { if (!HOP.has(k.toLowerCase()) && k.toLowerCase() !== "set-cookie") out.set(k, v); });
  for (const c of res.headers.getSetCookie?.() ?? []) out.append("set-cookie", c);
  return new Response(res.body, { status: res.status, headers: out });
}

export const GET = forward, POST = forward, PUT = forward, PATCH = forward, DELETE = forward;
