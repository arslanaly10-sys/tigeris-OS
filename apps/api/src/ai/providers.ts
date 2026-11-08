/**
 * Model providers behind the gateway (TR-020, Q061, Q062, Q066).
 * Local and deterministic run on this host. Anthropic and OpenAI are foreign: they need outbound
 * access, the foreign-model switch, an allowlist entry and a key in the deployment environment.
 * Keys are read from the process environment only; they are never stored in the database or shown.
 */
export type ProviderKey = "local" | "deterministic" | "anthropic" | "openai";
export const PROVIDER_KEYS: ProviderKey[] = ["local", "deterministic", "anthropic", "openai"];

export interface ProviderSpec {
  key: ProviderKey;
  label: string;
  vendor: string;
  foreign: boolean;
  hosts: string[]; // the only hosts the egress guard lets this provider reach
  model: string;
  priceInPerM: number | null; // USD per million input tokens; null = not priced
  priceOutPerM: number | null;
  residency: string;
  keyEnv?: string;
}

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : null);

export const PROVIDERS: Record<ProviderKey, ProviderSpec> = {
  local: {
    key: "local", label: "Local open-weight model", vendor: "Runs on this host (llama.cpp)", foreign: false, hosts: [],
    model: process.env.LOCAL_MODEL_NAME ?? "Qwen2.5 1.5B Instruct (Q4_K_M, Apache-2.0)", priceInPerM: 0, priceOutPerM: 0,
    residency: "In-country: weights and prompts stay on this host",
  },
  deterministic: {
    key: "deterministic", label: "Deterministic writer (no model)", vendor: "TIGERIS templates", foreign: false, hosts: [],
    model: "template-writer/1.0", priceInPerM: 0, priceOutPerM: 0, residency: "In-country: no model involved",
  },
  anthropic: {
    key: "anthropic", label: "Claude (Anthropic)", vendor: "Anthropic, United States", foreign: true, hosts: ["api.anthropic.com"],
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5", priceInPerM: num(process.env.ANTHROPIC_PRICE_IN) ?? 4, priceOutPerM: num(process.env.ANTHROPIC_PRICE_OUT) ?? 20,
    residency: "Foreign: prompts leave the institution's boundary", keyEnv: "ANTHROPIC_API_KEY",
  },
  openai: {
    key: "openai", label: "OpenAI", vendor: "OpenAI, United States", foreign: true, hosts: ["api.openai.com"],
    model: process.env.OPENAI_MODEL ?? "gpt-5", priceInPerM: num(process.env.OPENAI_PRICE_IN), priceOutPerM: num(process.env.OPENAI_PRICE_OUT),
    residency: "Foreign: prompts leave the institution's boundary", keyEnv: "OPENAI_API_KEY",
  },
};

export function keyConfigured(p: ProviderSpec): boolean {
  return !p.keyEnv || !!process.env[p.keyEnv];
}

export function costOf(p: ProviderSpec, tokensIn: number, tokensOut: number): { usd: number; priced: boolean } {
  if (p.priceInPerM === null || p.priceOutPerM === null) return { usd: 0, priced: false };
  return { usd: (tokensIn * p.priceInPerM + tokensOut * p.priceOutPerM) / 1_000_000, priced: true };
}
