/**
 * One provider choice for every AI surface (CRM features, AI chat, Lead Finder).
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

import { openCustomApiKey } from "./custom-provider";

export type ResolvedAIProviderName =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "groq"
  | "ollama"
  | "custom";

export interface AIProviderSettings {
  ai_provider?: string | null;
  api_key?: string | null;
  openrouter_api_key?: string | null;
  openrouter_oauth_token?: string | null;
  openrouter_expires_at?: string | null;
  openai_api_key?: string | null;
  groq_api_key?: string | null;
  ollama_base_url?: string | null;
  custom_base_url?: string | null;
  custom_api_key?: string | null;
  custom_model?: string | null;
  custom_fast_model?: string | null;
}

export interface ResolvedAIProvider {
  provider: ResolvedAIProviderName;
  apiKey?: string;
  baseURL?: string;
}

/** Fallback order when no usable provider was chosen explicitly. */
export const AI_PROVIDER_ORDER: readonly ResolvedAIProviderName[] = [
  "anthropic",
  "openrouter",
  "openai",
  "groq",
  "ollama",
  "custom",
];

type Credential = Omit<ResolvedAIProvider, "provider">;

function orgCredential(
  provider: ResolvedAIProviderName,
  settings: AIProviderSettings,
  now: number
): Credential | null {
  switch (provider) {
    case "anthropic":
      return settings.api_key ? { apiKey: settings.api_key } : null;
    case "openrouter": {
      // A live OAuth token wins over a stored key; an expired one is ignored.
      const expiresAt = settings.openrouter_expires_at
        ? Date.parse(settings.openrouter_expires_at)
        : NaN;
      if (settings.openrouter_oauth_token && expiresAt > now) {
        return { apiKey: settings.openrouter_oauth_token };
      }
      return settings.openrouter_api_key
        ? { apiKey: settings.openrouter_api_key }
        : null;
    }
    case "openai":
      return settings.openai_api_key ? { apiKey: settings.openai_api_key } : null;
    case "groq":
      return settings.groq_api_key ? { apiKey: settings.groq_api_key } : null;
    case "ollama":
      return settings.ollama_base_url ? { baseURL: settings.ollama_base_url } : null;
    case "custom": {
      // Both the tenant URL and a decryptable (sealed) key are required.
      const apiKey = openCustomApiKey(settings.custom_api_key);
      return settings.custom_base_url && apiKey
        ? { apiKey, baseURL: settings.custom_base_url }
        : null;
    }
  }
}

function envCredential(
  provider: ResolvedAIProviderName,
  env: Record<string, string | undefined>
): Credential | null {
  // SECURITY: never send a server env key to a tenant-configured URL.
  if (provider === "custom") return null;
  const value = {
    anthropic: env.ANTHROPIC_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    openai: env.OPENAI_API_KEY,
    groq: env.GROQ_API_KEY,
    ollama: env.OLLAMA_BASE_URL,
  }[provider];
  if (!value) return null;
  return provider === "ollama" ? { baseURL: value } : { apiKey: value };
}

function isProviderName(value: unknown): value is ResolvedAIProviderName {
  return AI_PROVIDER_ORDER.includes(value as ResolvedAIProviderName);
}

/**
 * Pick the provider (and credential) to use.
 *
 * - An explicitly chosen provider is used only when it has a credential
 *   (org key, unexpired OpenRouter OAuth token, or env key).
 * - Otherwise the first provider with an org credential in the order
 *   anthropic, openrouter, openai, groq, ollama, custom; then the first with
 *   an env credential in the same order. Org credentials beat env credentials.
 * - "custom" needs an org base URL and key and never uses an env credential.
 * - null when nothing is configured.
 */
export function resolveAIProvider(
  settings: AIProviderSettings,
  env: Record<string, string | undefined>,
  now = Date.now()
): ResolvedAIProvider | null {
  const explicit = settings.ai_provider;
  if (isProviderName(explicit)) {
    const cred = orgCredential(explicit, settings, now) ?? envCredential(explicit, env);
    if (cred) return { provider: explicit, ...cred };
  }

  for (const provider of AI_PROVIDER_ORDER) {
    const cred = orgCredential(provider, settings, now);
    if (cred) return { provider, ...cred };
  }
  for (const provider of AI_PROVIDER_ORDER) {
    const cred = envCredential(provider, env);
    if (cred) return { provider, ...cred };
  }
  return null;
}
