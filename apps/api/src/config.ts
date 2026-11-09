function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(env("API_PORT", "4000")),
  ownerUrl: env("DATABASE_OWNER_URL", "postgres://tigeris_owner:tigeris_owner@localhost:5432/tigeris"),
  appUrl: env("DATABASE_APP_URL", "postgres://tigeris_app:tigeris_app@localhost:5432/tigeris"),
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
