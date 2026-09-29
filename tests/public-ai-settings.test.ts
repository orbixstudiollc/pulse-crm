import { describe, expect, it } from "vitest";
import { omitBlankAISecrets, pickWritableAISettings, toPublicAISettings } from "@/lib/ai/public-settings";
import { AI_SETTINGS_SECRET_COLUMNS, type AISettings } from "@/lib/ai/types";

function makeRow(secret: string | null): AISettings {
  const row = {
    id: "settings-1",
    organization_id: "org-1",
    ai_provider: "anthropic",
    default_model: "sonnet",
    feature_chat: true,
    tokens_used_today: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...Object.fromEntries(AI_SETTINGS_SECRET_COLUMNS.map((col) => [col, secret === null ? null : `${secret}-${col}`])),
  };
  return row as unknown as AISettings;
}

const FLAGS = ["has_api_key", "has_openai_api_key", "has_openrouter_api_key", "has_groq_api_key", "has_apify_api_key"] as const;

describe("toPublicAISettings", () => {
  it("removes all seven secret columns and sets every flag when keys are present", () => {
    const result = toPublicAISettings(makeRow("sk-secret"));

    for (const col of AI_SETTINGS_SECRET_COLUMNS) {
      expect(col in result).toBe(false);
    }
    for (const flag of FLAGS) {
      expect(result[flag]).toBe(true);
    }
    expect(JSON.stringify(result)).not.toContain("sk-secret");
    expect(result.ai_provider).toBe("anthropic");
    expect(result.organization_id).toBe("org-1");
  });

  it("sets every flag to false when keys are null", () => {
    const result = toPublicAISettings(makeRow(null));

    for (const col of AI_SETTINGS_SECRET_COLUMNS) {
      expect(col in result).toBe(false);
    }
    for (const flag of FLAGS) {
      expect(result[flag]).toBe(false);
    }
  });
});

describe("omitBlankAISecrets", () => {
  it("drops blank secret fields and keeps non-empty keys and non-secret fields", () => {
    const input: Record<string, unknown> = {
      api_key: "",
      openrouter_api_key: "   ",
      apify_api_key: null,
      openai_api_key: undefined,
      groq_api_key: "gsk-new-key",
      ai_provider: "openrouter",
      default_model: "",
    };
    const snapshot = { ...input };

    const result = omitBlankAISecrets(input);

    expect("api_key" in result).toBe(false);
    expect("openrouter_api_key" in result).toBe(false);
    expect("apify_api_key" in result).toBe(false);
    expect("openai_api_key" in result).toBe(false);
    expect(result.groq_api_key).toBe("gsk-new-key");
    expect(result.ai_provider).toBe("openrouter");
    expect(result.default_model).toBe("");
    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
    expect(Object.keys(input)).toEqual(Object.keys(snapshot));
  });
});

describe("pickWritableAISettings", () => {
  it("keeps settings and secret columns and drops usage, limit and identity columns", () => {
    const input: Record<string, unknown> = {
      feature_chat: false,
      ai_provider: "openrouter",
      api_key: "sk-new-key",
      tokens_used_today: 0,
      daily_token_limit: 999999999,
      organization_id: "other-org",
      id: "settings-2",
    };

    const result = pickWritableAISettings(input);

    expect(result).toEqual({ feature_chat: false, ai_provider: "openrouter", api_key: "sk-new-key" });
    expect(result).not.toBe(input);
  });
});
