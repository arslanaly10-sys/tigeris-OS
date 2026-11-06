function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(env("API_PORT", "4000")),
  ownerUrl: env("DATABASE_OWNER_URL", "postgres://tigeris_owner:tigeris_owner@localhost:5432/tigeris"),
  appUrl: env("DATABASE_APP_URL", "postgres://tigeris_app:tigeris_app@localhost:5432/tigeris"),
  sessionSecret: env("SESSION_SECRET", "change-me-demo-only"),
  sessionHours: 12,
  cookieName: "tigeris_session",
};
