import { AI_SETTINGS_SECRET_COLUMNS, type AISettings, type PublicAISettings } from "./types";

type SecretColumn = (typeof AI_SETTINGS_SECRET_COLUMNS)[number];
type SettingsRow = AISettings & Partial<Record<SecretColumn, string | null>>;

/** Strips every secret column and exposes only whether each key is set. */
export function toPublicAISettings(row: AISettings): PublicAISettings {
  const {
    api_key,
    openai_api_key,
    openrouter_api_key,
    groq_api_key,
    apify_api_key,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped on purpose
    openrouter_oauth_token: _oauthToken,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped on purpose
    openrouter_code_verifier: _codeVerifier,
    ...rest
  } = row as SettingsRow;
  return {
    ...rest,
    has_api_key: !!api_key,
    has_openai_api_key: !!openai_api_key,
    has_openrouter_api_key: !!openrouter_api_key,
    has_groq_api_key: !!groq_api_key,
    has_apify_api_key: !!apify_api_key,
  };
}

/** Returns a copy of `updates` without secret fields that are blank (so saved keys are kept). */
export function omitBlankAISecrets<T extends Record<string, unknown>>(updates: T): Partial<T> {
  const secrets = AI_SETTINGS_SECRET_COLUMNS as readonly string[];
  return Object.fromEntries(
    Object.entries(updates).filter(
      ([key, value]) =>
        !(secrets.includes(key) && (value === undefined || value === null || (typeof value === "string" && value.trim() === "")))
    )
  ) as Partial<T>;
}
