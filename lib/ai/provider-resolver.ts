/**
 * One provider choice for every AI surface (CRM features, AI chat, Lead Finder).
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

import {
  normalizeCustomBaseUrl,
  openCustomApiKey,
  type CustomModelSettings,
} from "./custom-provider";

export type ResolvedAIProviderName =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "groq"
  | "ollama"
  | "custom";

export interface AIProviderSettings {
  /** Required for "custom": its key is sealed for this org. */
  organization_id?: string | null;
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
  /** "org": the workspace's own credential; "env": a server-wide one. */
  source: "org" | "env";
  apiKey?: string;
  baseURL?: string;
  /** Env custom fallback only: the operator's models (CUSTOM_AI_MODEL / CUSTOM_AI_FAST_MODEL). */
  model?: string;
  fastModel?: string;
}

export const DEFAULT_ENV_CUSTOM_MODEL = "claude-sonnet-4.6";
export const DEFAULT_ENV_CUSTOM_FAST_MODEL = "claude-haiku-4.5";

/** Fallback order when no usable provider was chosen explicitly. */
export const AI_PROVIDER_ORDER: readonly ResolvedAIProviderName[] = [
  "anthropic",
  "openrouter",
  "openai",
  "groq",
  "ollama",
  "custom",
];

type Credential = Omit<ResolvedAIProvider, "provider" | "source">;

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
      // Both the tenant URL and a key sealed for this org and URL are required.
      const apiKey = openCustomApiKey(
        settings.custom_api_key,
        settings.organization_id,
        settings.custom_base_url
      );
      return settings.custom_base_url && apiKey
        ? { apiKey, baseURL: settings.custom_base_url }
        : null;
    }
  }
}

/**
 * The operator's server-wide Anthropic-compatible endpoint. SECURITY: the URL,
 * key and models all come from env, never from a tenant's settings, so the env
 * key is only ever sent to the env URL.
 */
function envCustomCredential(env: Record<string, string | undefined>): Credential | null {
  const apiKey = env.CUSTOM_AI_API_KEY?.trim();
  const rawBase = env.CUSTOM_AI_BASE_URL?.trim();
  if (!apiKey || !rawBase) return null;
  let baseURL: string;
  try {
    baseURL = normalizeCustomBaseUrl(rawBase);
  } catch {
    return null;
  }
  return {
    apiKey,
    baseURL,
    model: env.CUSTOM_AI_MODEL?.trim() || DEFAULT_ENV_CUSTOM_MODEL,
    fastModel: env.CUSTOM_AI_FAST_MODEL?.trim() || DEFAULT_ENV_CUSTOM_FAST_MODEL,
  };
}

function envCredential(
  provider: ResolvedAIProviderName,
  env: Record<string, string | undefined>
): Credential | null {
  if (provider === "custom") return envCustomCredential(env);
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
 * - An org "custom" credential needs the org base URL and a key sealed for it.
 * - The env "custom" credential (CUSTOM_AI_*) is tried last of all, even when
 *   "custom" was chosen explicitly. It carries its own URL and models; nothing
 *   from the org's custom_* settings is ever combined with the env key.
 * - null when nothing is configured.
 */
export function resolveAIProvider(
  settings: AIProviderSettings,
  env: Record<string, string | undefined>,
  now = Date.now()
): ResolvedAIProvider | null {
  const explicit = settings.ai_provider;
  if (isProviderName(explicit)) {
    const org = orgCredential(explicit, settings, now);
    if (org) return { provider: explicit, source: "org", ...org };
    // The env custom fallback stays last, after every other credential.
    const fromEnv = explicit === "custom" ? null : envCredential(explicit, env);
    if (fromEnv) return { provider: explicit, source: "env", ...fromEnv };
  }

  for (const provider of AI_PROVIDER_ORDER) {
    const cred = orgCredential(provider, settings, now);
    if (cred) return { provider, source: "org", ...cred };
  }
  // "custom" is last in AI_PROVIDER_ORDER, so the env custom fallback is tried last.
  for (const provider of AI_PROVIDER_ORDER) {
    const cred = envCredential(provider, env);
    if (cred) return { provider, source: "env", ...cred };
  }
  return null;
}

/**
 * The custom model settings to use with a resolved provider: the env custom
 * fallback's own models, otherwise the org's settings unchanged.
 */
export function customModelSettingsFor(
  resolved: ResolvedAIProvider,
  settings?: CustomModelSettings | null
): CustomModelSettings | null | undefined {
  if (resolved.provider === "custom" && resolved.source === "env") {
    return { custom_model: resolved.model ?? null, custom_fast_model: resolved.fastModel ?? null };
  }
  return settings;
}
