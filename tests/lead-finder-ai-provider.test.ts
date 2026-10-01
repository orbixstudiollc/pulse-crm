// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAIProvider } from "@/lib/ai/provider-resolver";

// ---------------------------------------------------------------------------
// Lead Finder completions: the provider resolver, the shared budget, the
// settings read and both SDKs are faked, so each test sees which key, URL and
// model a call used and in which order the budget was touched.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
  settingsReads: 0,
  resolved: null as unknown,
  resolveCalls: [] as Array<Record<string, unknown>>,
  events: [] as string[],
  reservation: { ok: true, day: "2026-10-01", reserved: 1000 } as
    | { ok: true; day: string; reserved: number }
    | { ok: false; reason: string },
  isGuest: false,
  guestLookups: [] as string[],
  reserveArgs: [] as Array<[string, number, { isGuest: boolean }]>,
  settleArgs: [] as Array<[string, string, number, number | undefined, { isGuest: boolean }]>,
  openaiCtor: [] as Array<Record<string, unknown>>,
  openaiParams: [] as Array<Record<string, unknown>>,
  anthropicCtor: [] as Array<Record<string, unknown>>,
  anthropicParams: [] as Array<Record<string, unknown>>,
  failProvider: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "eq", "limit"]) builder[op] = () => builder;
      builder.maybeSingle = async () => {
        if (table === "ai_settings") h.settingsReads++;
        return { data: h.settings, error: null };
      };
      return builder;
    },
  }),
  createClient: async () => ({}),
}));
vi.mock("@/lib/lead-finder/apify/token", () => ({
  getApifyToken: async () => "apify",
  getApifyTokenFromEnv: () => undefined,
}));
vi.mock("@/lib/ai/provider-resolver", () => ({
  resolveAIProvider: (settings: Record<string, unknown>) => {
    h.resolveCalls.push(settings);
    return h.resolved;
  },
}));
vi.mock("@/lib/ai/shared-budget", () => ({
  sharedCallerIsGuest: async (orgId: string) => {
    h.guestLookups.push(orgId);
    return h.isGuest;
  },
  reserveSharedTokens: async (orgId: string, estimate: number, opts: { isGuest: boolean }) => {
    h.events.push("reserve");
    h.reserveArgs.push([orgId, estimate, opts]);
    return h.reservation;
  },
  settleSharedTokens: async (
    orgId: string,
    day: string,
    reserved: number,
    actual: number | undefined,
    opts: { isGuest: boolean }
  ) => {
    h.events.push("settle");
    h.settleArgs.push([orgId, day, reserved, actual, opts]);
  },
  recordSharedUsage: async () => {
    h.events.push("record");
  },
}));
vi.mock("@/lib/security/fetch-target", () => ({ assertSafeFetchTarget: async () => ({}) }));
vi.mock("@/lib/security/safe-fetch", () => ({
  createPinnedFetch: () => ({ fetch: async () => new Response(), close: async () => {} }),
}));
vi.mock("@/lib/ai/custom-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/custom-provider")>()),
  createCustomFetch: async (base: string) => ({ base, fetch: async () => new Response(), close: async () => {} }),
}));
vi.mock("openai", () => ({
  default: class FakeOpenAI {
    constructor(opts: Record<string, unknown>) {
      h.openaiCtor.push(opts);
    }
    chat = {
      completions: {
        create: async (params: Record<string, unknown>) => {
          h.events.push("call");
          h.openaiParams.push(params);
          if (h.failProvider) throw new Error("503 unavailable");
          return { choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 40, completion_tokens: 2 } };
        },
      },
    };
  },
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    constructor(opts: Record<string, unknown>) {
      h.anthropicCtor.push(opts);
    }
    messages = {
      create: async (params: Record<string, unknown>) => {
        h.events.push("call");
        h.anthropicParams.push(params);
        if (h.failProvider) throw new Error("503 unavailable");
        return { content: [{ type: "text", text: "ok" }], usage: { input_tokens: 40, output_tokens: 2 } };
      },
    };
  },
}));

const { generateCompletion } = await import("@/lib/lead-finder/ai-provider");
const { SharedBudgetError, SHARED_BUDGET_WORKSPACE_REASON, estimateTokens } = await import(
  "@/lib/ai/shared-budget-core"
);

const ORG = "11111111-1111-4111-8111-111111111111";
const MESSAGES = [
  { role: "system" as const, content: "You filter leads." },
  { role: "user" as const, content: "Find SaaS founders in Berlin." },
];
const ENV_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "OLLAMA_BASE_URL"];

function resolveTo(resolved: ResolvedAIProvider | null) {
  h.resolved = resolved;
}

beforeEach(() => {
  h.settings = { ai_provider: null, default_model: null };
  h.settingsReads = 0;
  h.resolved = null;
  h.resolveCalls = [];
  h.events = [];
  h.reservation = { ok: true, day: "2026-10-01", reserved: 1000 };
  h.isGuest = false;
  h.guestLookups = [];
  h.reserveArgs = [];
  h.settleArgs = [];
  h.openaiCtor = [];
  h.openaiParams = [];
  h.anthropicCtor = [];
  h.anthropicParams = [];
  h.failProvider = false;
  // Decoy env credentials: none of them may be used unless the resolver chose them.
  for (const key of ENV_KEYS) process.env[key] = `decoy-${key}`;
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("M1: credentials come only from the single resolved result", () => {
  it("reads the org's settings once and resolves once per completion", async () => {
    h.settings = { ai_provider: "anthropic", default_model: null, api_key: "org-key-not-resolved" };
    resolveTo({ provider: "anthropic", source: "org", apiKey: "resolved-anthropic" });
    await generateCompletion(MESSAGES, "anthropic", ORG);
    expect(h.settingsReads).toBe(1);
    expect(h.resolveCalls).toHaveLength(1);
    expect(h.anthropicCtor).toEqual([{ apiKey: "resolved-anthropic" }]);
  });

  it.each([
    ["openai", undefined],
    ["groq", "https://api.groq.com/openai/v1"],
    ["openrouter", "https://openrouter.ai/api/v1"],
  ] as const)("%s uses the resolved key, never an env or settings key", async (provider, baseURL) => {
    h.settings = { ai_provider: provider, default_model: null, openai_api_key: "settings-key", groq_api_key: "settings-key" };
    resolveTo({ provider, source: "org", apiKey: `resolved-${provider}` });
    await generateCompletion(MESSAGES, provider, ORG);
    expect(h.openaiCtor).toHaveLength(1);
    expect(h.openaiCtor[0].apiKey).toBe(`resolved-${provider}`);
    expect(h.openaiCtor[0].baseURL).toBe(baseURL);
  });

  it("ollama uses the resolved base URL, never OLLAMA_BASE_URL or a localhost default", async () => {
    resolveTo({ provider: "ollama", source: "org", baseURL: "https://ollama.example.com/v1" });
    await generateCompletion(MESSAGES, "ollama", ORG);
    expect(h.openaiCtor[0].baseURL).toBe("https://ollama.example.com/v1");
  });

  it("does not fall back to an env key when the resolver found no credential", async () => {
    resolveTo(null);
    await expect(generateCompletion(MESSAGES, "openrouter", ORG)).rejects.toThrow(/OpenRouter API key not configured/);
    expect(h.openaiCtor).toHaveLength(0);
    expect(h.events).toEqual([]);
  });
});

describe("M2: the model is fixed on env credentials", () => {
  it.each([
    ["anthropic", "claude-sonnet-4-6"],
    ["openai", "gpt-4o"],
    ["openrouter", "anthropic/claude-sonnet-4-5"],
    ["groq", "llama-4-maverick-17b-128e-instruct"],
  ] as const)("env %s uses %s, ignoring the saved and requested models", async (provider, model) => {
    h.settings = { ai_provider: provider, default_model: "tenant-picked-expensive-model" };
    resolveTo({ provider, source: "env", apiKey: `env-${provider}` });
    await generateCompletion(MESSAGES, provider, ORG, { model: "caller-picked-model" });
    const params = provider === "anthropic" ? h.anthropicParams[0] : h.openaiParams[0];
    expect(params.model).toBe(model);
  });

  it("the env custom fallback uses its own model", async () => {
    h.settings = { ai_provider: "custom", default_model: "tenant-model", custom_model: "tenant-custom" };
    resolveTo({
      provider: "custom",
      source: "env",
      apiKey: "env-custom",
      baseURL: "https://relay.example.com",
      model: "claude-sonnet-4.6",
    });
    await generateCompletion(MESSAGES, "custom", ORG, { model: "caller-picked-model" });
    expect(h.anthropicParams[0].model).toBe("claude-sonnet-4.6");
    expect(h.anthropicCtor[0]).toMatchObject({ apiKey: "env-custom", baseURL: "https://relay.example.com" });
  });

  it("the org's own key still honours the saved and requested models", async () => {
    h.settings = { ai_provider: "openai", default_model: "gpt-4o-mini" };
    resolveTo({ provider: "openai", source: "org", apiKey: "org-openai" });
    await generateCompletion(MESSAGES, "openai", ORG);
    expect(h.openaiParams[0].model).toBe("gpt-4o-mini");
    await generateCompletion(MESSAGES, "openai", ORG, { model: "gpt-4o" });
    expect(h.openaiParams[1].model).toBe("gpt-4o");
  });
});

describe("shared-key reservation", () => {
  const envAnthropic: ResolvedAIProvider = { provider: "anthropic", source: "env", apiKey: "env-anthropic" };

  it("reserves the estimate before the call and settles with actual usage after", async () => {
    resolveTo(envAnthropic);
    await generateCompletion(MESSAGES, "anthropic", ORG, { maxTokens: 512 });
    expect(h.events).toEqual(["reserve", "call", "settle", "record"]);
    expect(h.reserveArgs).toEqual([
      [ORG, estimateTokens({ input: JSON.stringify(MESSAGES), maxOutputTokens: 512 }), { isGuest: false }],
    ]);
    expect(h.settleArgs).toEqual([[ORG, "2026-10-01", 1000, 42, { isGuest: false }]]);
  });

  it("decides guest from the workspace (no session in background jobs) and settles in the same pool", async () => {
    resolveTo(envAnthropic);
    h.isGuest = true;
    await generateCompletion(MESSAGES, "anthropic", ORG);
    expect(h.guestLookups).toEqual([ORG]);
    expect(h.reserveArgs[0][2]).toEqual({ isGuest: true });
    expect(h.settleArgs[0][4]).toEqual({ isGuest: true });
  });

  it("counts non-ASCII input as a token per character in the estimate", async () => {
    resolveTo(envAnthropic);
    const cjk = [{ role: "user" as const, content: "東京のSaaS創業者を探して".repeat(50) }];
    await generateCompletion(cjk, "anthropic", ORG, { maxTokens: 100 });
    const asciiOnly = Math.ceil(JSON.stringify(cjk).length / 3) + 100;
    expect(h.reserveArgs[0][1]).toBe(estimateTokens({ input: JSON.stringify(cjk), maxOutputTokens: 100 }));
    expect(h.reserveArgs[0][1]).toBeGreaterThan(asciiOnly);
  });

  it("refuses with the user-facing reason and never calls the provider", async () => {
    resolveTo(envAnthropic);
    h.reservation = { ok: false, reason: SHARED_BUDGET_WORKSPACE_REASON };
    const err = await generateCompletion(MESSAGES, "anthropic", ORG).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_WORKSPACE_REASON);
    expect(h.events).toEqual(["reserve"]);
  });

  it("keeps the reservation when the provider call fails", async () => {
    resolveTo(envAnthropic);
    h.failProvider = true;
    await expect(generateCompletion(MESSAGES, "anthropic", ORG)).rejects.toThrow("503 unavailable");
    expect(h.events).toEqual(["reserve", "call"]);
  });

  it("Ollama Cloud (always the owner's env key) reserves and settles too", async () => {
    h.settings = { ai_provider: "ollama_cloud", default_model: null };
    process.env.OLLAMA_CLOUD_API_KEY = "test-cloud-key";
    const fetchMock = vi.fn(async () => {
      h.events.push("call");
      return Response.json({ message: { content: "ok" }, prompt_eval_count: 30, eval_count: 5 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await generateCompletion(MESSAGES, "ollama_cloud", ORG);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.OLLAMA_CLOUD_API_KEY;
    }
    expect(h.events).toEqual(["reserve", "call", "settle", "record"]);
    expect(h.settleArgs[0][3]).toBe(35);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-cloud-key");
  });

  it("never touches the shared budget for the org's own key", async () => {
    resolveTo({ provider: "anthropic", source: "org", apiKey: "org-anthropic" });
    await generateCompletion(MESSAGES, "anthropic", ORG);
    expect(h.events).toEqual(["call"]);
    expect(h.guestLookups).toEqual([]);
  });
});
