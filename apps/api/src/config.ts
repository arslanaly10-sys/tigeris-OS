function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Hosted (Vercel + Neon): the database integration provides DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (owner).
 * The app role tigeris_app (NOBYPASSRLS) uses the same host with its own password, TIGERIS_APP_PASSWORD, set as a
 * secret in the hosting environment and never stored in the repository.
 */
function appUrlFromHosted(): string | undefined {
  const base = process.env.DATABASE_URL, pw = process.env.TIGERIS_APP_PASSWORD;
  if (!base || !pw) return undefined;
  const u = new URL(base);
  u.username = "tigeris_app";
  u.password = pw;
  return u.toString();
}

export const config = {
  port: Number(process.env.PORT ?? env("API_PORT", "4000")),
  ownerUrl: process.env.DATABASE_OWNER_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "postgres://tigeris_owner:tigeris_owner@localhost:5432/tigeris",
  appUrl: process.env.DATABASE_APP_URL ?? appUrlFromHosted() ?? "postgres://tigeris_app:tigeris_app@localhost:5432/tigeris",
  /** Hosted only: the web app sends this in x-tigeris-key; requests without it are refused. Unset locally. */
  sharedKey: process.env.TIGERIS_SHARED_KEY ?? "",
  reasoningUrl: env("REASONING_URL", "http://localhost:8000"),
  sessionSecret: env("SESSION_SECRET", "change-me-demo-only"),
  sessionHours: 12,
  /**
   * Demo-only shortcuts: the reset button and the role switcher. On by default in development and in the
   * demo package (docker-compose sets DEMO_MODE=on); a pilot sets DEMO_MODE=off.
   */
  demoMode: env("DEMO_MODE", process.env.NODE_ENV === "production" ? "off" : "on") === "on",
  cookieName: "tigeris_session",
};
