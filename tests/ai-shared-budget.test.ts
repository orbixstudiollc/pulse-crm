// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fake Supabase admin client: records rpc calls (answered from `rpcResults`)
// and the profiles lookup / ai_usage_log insert used by recordSharedUsage.
// A fake Anthropic SDK records provider calls, so the order reserve -> call ->
// settle can be checked without a network.
// ---------------------------------------------------------------------------

type Call = { table: string; ops: Array<[string, ...unknown[]]> };
type RpcResult = { data: unknown; error: { message: string } | null } | "reject";

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResults: {} as Record<string, RpcResult[]>,
  inserts: [] as Array<Record<string, unknown>>,
  profiles: [] as Array<{ id: string }>,
  sessionUserId: null as string | null,
  adminThrows: false,
  events: [] as string[],
}));

const sdk = vi.hoisted(() => ({
  create: null as null | ((params: Record<string, unknown>) => Promise<unknown>),
  params: [] as Array<Record<string, unknown>>,
}));

function fakeQuery(table: string) {
  const call: Call = { table, ops: [] };
  db.calls.push(call);
  const builder: Record<string, unknown> = {};
  for (const op of ["select", "eq", "gte", "order", "limit"]) {
    builder[op] = (...args: unknown[]) => {
      call.ops.push([op, ...args]);
      return builder;
    };
  }
  builder.maybeSingle = () => {
    call.ops.push(["maybeSingle"]);
    return Promise.resolve({ data: db.profiles[0] ?? null, error: null });
  };
  builder.insert = (row: Record<string, unknown>) => {
    db.inserts.push(row);
    return Promise.resolve({ error: null });
  };
  return builder;
}

function fakeRpc(fn: string, args: Record<string, unknown>) {
  db.rpcCalls.push({ fn, args });
  db.events.push(fn);
  const next = db.rpcResults[fn]?.shift() ?? { data: fn === "reserve_shared_ai_tokens" ? "ok" : null, error: null };
  if (next === "reject") return Promise.reject(new Error("network down"));
  return Promise.resolve(next);
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    if (db.adminThrows) throw new Error("no service role");
    return { from: fakeQuery, rpc: fakeRpc };
  },
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: db.sessionUserId ? { id: db.sessionUserId } : null } }),
    },
  }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: async (params: Record<string, unknown>) => {
        sdk.params.push(params);
        db.events.push("create");
        if (!sdk.create) throw new Error("no fake response");
        return sdk.create(params);
      },
    };
  },
}));

const core = await import("@/lib/ai/shared-budget-core");
const { reserveSharedTokens, settleSharedTokens, recordSharedUsage } = await import("@/lib/ai/shared-budget");

const {
  DEFAULT_SHARED_DAILY_TOKEN_LIMIT,
  DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT,
  SHARED_BUDGET_BUSY_REASON,
  SHARED_BUDGET_WORKSPACE_REASON,
  SHARED_MAX_OUTPUT_TOKENS,
  SharedBudgetError,
  estimateTokens,
  parseLimit,
  reservationReason,
  settlementDelta,
  sharedBudgetLimits,
  utcDay,
} = core;

const ORG = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-01T15:30:00Z");

beforeEach(() => {
  db.calls = [];
  db.rpcCalls = [];
  db.rpcResults = {};
  db.inserts = [];
  db.profiles = [];
  db.sessionUserId = null;
  db.adminThrows = false;
  db.events = [];
  sdk.create = null;
  sdk.params = [];
  delete process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT;
  delete process.env.AI_SHARED_DAILY_TOKEN_LIMIT;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("user-facing reasons", () => {
  it("uses the agreed wording", () => {
    expect(SHARED_BUDGET_WORKSPACE_REASON).toBe(
      "Today's AI limit for this workspace is used up. It resets at midnight UTC."
    );
    expect(SHARED_BUDGET_BUSY_REASON).toBe("AI is busy right now. Please try again later.");
  });

  it("SharedBudgetError carries the reason as its message", () => {
    const err = new SharedBudgetError(SHARED_BUDGET_BUSY_REASON);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SharedBudgetError");
    expect(err.message).toBe(SHARED_BUDGET_BUSY_REASON);
  });
});

describe("parseLimit", () => {
  it("falls back when the value is missing or blank", () => {
    expect(parseLimit(undefined, 50_000)).toBe(50_000);
    expect(parseLimit("", 50_000)).toBe(50_000);
    expect(parseLimit("   ", 50_000)).toBe(50_000);
  });

  it("reads a whole non-negative number, ignoring surrounding spaces", () => {
    expect(parseLimit("2500", 50_000)).toBe(2500);
    expect(parseLimit(" 1000000 ", 50_000)).toBe(1_000_000);
    expect(parseLimit("0", 50_000)).toBe(0);
  });

  it("falls back on anything that is not a whole non-negative number", () => {
    for (const bad of ["-5", "abc", "1.5", "1e6", "12abc", "Infinity", "NaN", "0x10"]) {
      expect(parseLimit(bad, 7)).toBe(7);
    }
  });
});

describe("sharedBudgetLimits", () => {
  it("defaults to 50,000 per workspace and 1,000,000 site-wide", () => {
    expect(DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT).toBe(50_000);
    expect(DEFAULT_SHARED_DAILY_TOKEN_LIMIT).toBe(1_000_000);
    expect(sharedBudgetLimits({})).toEqual({ orgLimit: 50_000, siteLimit: 1_000_000 });
  });

  it("reads AI_SHARED_ORG_DAILY_TOKEN_LIMIT and AI_SHARED_DAILY_TOKEN_LIMIT", () => {
    expect(
      sharedBudgetLimits({ AI_SHARED_ORG_DAILY_TOKEN_LIMIT: "10", AI_SHARED_DAILY_TOKEN_LIMIT: "20" })
    ).toEqual({ orgLimit: 10, siteLimit: 20 });
    expect(sharedBudgetLimits({ AI_SHARED_ORG_DAILY_TOKEN_LIMIT: "nope" })).toEqual({
      orgLimit: 50_000,
      siteLimit: 1_000_000,
    });
  });
});

describe("estimateTokens", () => {
  it("is a third of the input characters, rounded up, plus the output cap", () => {
    expect(estimateTokens({ inputChars: 0, maxOutputTokens: 1024 })).toBe(1024);
    expect(estimateTokens({ inputChars: 3, maxOutputTokens: 1024 })).toBe(1025);
    expect(estimateTokens({ inputChars: 4, maxOutputTokens: 1024 })).toBe(1026);
    expect(estimateTokens({ inputChars: 30_000, maxOutputTokens: 4096 })).toBe(14_096);
  });
});

describe("reservationReason", () => {
  it("is null when the reservation went through", () => {
    expect(reservationReason("ok")).toBeNull();
  });

  it("maps the workspace limit to the workspace reason", () => {
    expect(reservationReason("org_limit")).toBe(SHARED_BUDGET_WORKSPACE_REASON);
  });

  it("maps the site-wide limit, and anything unexpected, to the busy reason", () => {
    for (const result of ["site_limit", "", "OK", null, undefined, 42]) {
      expect(reservationReason(result)).toBe(SHARED_BUDGET_BUSY_REASON);
    }
  });
});

describe("settlementDelta", () => {
  it("charges the difference between actual usage and the reservation", () => {
    expect(settlementDelta(1000, 1500)).toBe(500);
    expect(settlementDelta(1000, 400)).toBe(-600);
    expect(settlementDelta(1000, 1000)).toBe(0);
  });

  it("never refunds more than this call reserved", () => {
    expect(settlementDelta(1000, 1)).toBe(-999);
    expect(settlementDelta(1000, 1)).toBeGreaterThanOrEqual(-1000);
  });

  it("is null when actual usage is unknown, so the reservation stands", () => {
    for (const actual of [undefined, null, Number.NaN, Infinity, -5, 0]) {
      expect(settlementDelta(1000, actual)).toBeNull();
    }
  });
});

describe("utcDay", () => {
  it("is the UTC calendar day as YYYY-MM-DD", () => {
    expect(utcDay(new Date("2026-10-01T23:30:00+05:00"))).toBe("2026-10-01");
    // 02:00 in UTC+6 is still 30 September in UTC.
    expect(utcDay(new Date("2026-10-01T02:00:00+06:00"))).toBe("2026-09-30");
    expect(utcDay(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
  });
});

describe("reserveSharedTokens", () => {
  it("reserves the estimate against today's limits and returns the day to settle against", async () => {
    await expect(reserveSharedTokens(ORG, 1234)).resolves.toEqual({ ok: true, day: "2026-10-01", reserved: 1234 });
    expect(db.rpcCalls).toEqual([
      {
        fn: "reserve_shared_ai_tokens",
        args: { p_org: ORG, p_tokens: 1234, p_org_limit: 50_000, p_site_limit: 1_000_000 },
      },
    ]);
  });

  it("passes the limits from env (the owner sets them in Vercel)", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "20000";
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "300000";
    await reserveSharedTokens(ORG, 10);
    expect(db.rpcCalls[0].args).toMatchObject({ p_org_limit: 20_000, p_site_limit: 300_000 });
  });

  it("refuses with the workspace reason when the workspace limit would be passed", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: "org_limit", error: null }];
    await expect(reserveSharedTokens(ORG, 10)).resolves.toEqual({
      ok: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
  });

  it("refuses with the busy reason when the site-wide limit would be passed", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: "site_limit", error: null }];
    await expect(reserveSharedTokens(ORG, 10)).resolves.toEqual({ ok: false, reason: SHARED_BUDGET_BUSY_REASON });
  });

  it("fails closed with the busy reason on an RPC error, a rejection or no database", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: null, error: { message: "boom" } }, "reject"];
    const busy = { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
    await expect(reserveSharedTokens(ORG, 10)).resolves.toEqual(busy);
    await expect(reserveSharedTokens(ORG, 10)).resolves.toEqual(busy);
    db.adminThrows = true;
    await expect(reserveSharedTokens(ORG, 10)).resolves.toEqual(busy);
  });
});

describe("settleSharedTokens", () => {
  it("corrects the reservation to actual usage on the reservation's day", async () => {
    await settleSharedTokens(ORG, "2026-09-30", 1000, 1500);
    await settleSharedTokens(ORG, "2026-09-30", 1000, 300);
    expect(db.rpcCalls).toEqual([
      { fn: "settle_shared_ai_tokens", args: { p_org: ORG, p_day: "2026-09-30", p_delta: 500 } },
      { fn: "settle_shared_ai_tokens", args: { p_org: ORG, p_day: "2026-09-30", p_delta: -700 } },
    ]);
  });

  it("skips settling when usage is unknown or matches the reservation", async () => {
    await settleSharedTokens(ORG, "2026-10-01", 1000, undefined);
    await settleSharedTokens(ORG, "2026-10-01", 1000, 0);
    await settleSharedTokens(ORG, "2026-10-01", 1000, 1000);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("never throws", async () => {
    db.rpcResults.settle_shared_ai_tokens = [{ data: null, error: { message: "boom" } }, "reject"];
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10)).resolves.toBeUndefined();
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10)).resolves.toBeUndefined();
    db.adminThrows = true;
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10)).resolves.toBeUndefined();
  });
});

describe("recordSharedUsage", () => {
  const usage = {
    orgId: ORG,
    feature: "lead_finder",
    model: "claude-sonnet-4.6",
    inputTokens: 120,
    outputTokens: 30,
    durationMs: 900,
    provider: "custom",
  };

  it("logs the call to ai_usage_log marked as shared-key usage, for the signed-in user", async () => {
    db.sessionUserId = "user-1";
    await recordSharedUsage(usage);
    expect(db.inserts).toEqual([
      expect.objectContaining({
        organization_id: ORG,
        user_id: "user-1",
        feature: "lead_finder",
        model: "claude-sonnet-4.6",
        input_tokens: 120,
        output_tokens: 30,
        total_tokens: 150,
        duration_ms: 900,
        success: true,
        metadata: { provider: "custom", shared_key: true },
      }),
    ]);
  });

  it("attributes background work (no session) to a member of the workspace", async () => {
    db.profiles = [{ id: "member-1" }];
    await recordSharedUsage(usage);
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ user_id: "member-1", total_tokens: 150 });
    const profileQuery = db.calls.find((c) => c.table === "profiles");
    expect(profileQuery?.ops).toContainEqual(["eq", "organization_id", ORG]);
  });

  it("never throws, even when nothing can be logged", async () => {
    await expect(recordSharedUsage(usage)).resolves.toBeUndefined();
    expect(db.inserts).toHaveLength(0);
    db.adminThrows = true;
    await expect(recordSharedUsage(usage)).resolves.toBeUndefined();
  });
});

describe("createAIMessagesClient shared-key reservation", () => {
  const envAnthropic = { provider: "anthropic" as const, source: "env" as const, apiKey: "test-only-key" };
  const params = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You are helpful.",
    messages: [{ role: "user" as const, content: "Score this lead please." }],
  };
  const expectedEstimate = (p: { system?: unknown; messages: unknown; max_tokens: number }) =>
    Math.ceil(JSON.stringify({ system: p.system, messages: p.messages }).length / 3) + p.max_tokens;
  const reply = (input: number, output: number) => async () => ({
    content: [{ type: "text", text: "ok" }],
    usage: { input_tokens: input, output_tokens: output },
  });
  const rpcNamed = (fn: string) => db.rpcCalls.filter((c) => c.fn === fn);

  it("refuses an env-credential call when no org is given to charge (fail closed)", async () => {
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_BUSY_REASON);
    expect(db.events).toEqual([]);
  });

  it("refuses with the workspace reason, without calling the provider, when the reservation is refused", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: "org_limit", error: null }];
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_WORKSPACE_REASON);
    expect(db.events).toEqual(["reserve_shared_ai_tokens"]);
  });

  it("reserves the estimate first, calls the provider, then settles to actual usage", async () => {
    sdk.create = reply(300, 200);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG);
    const res = await client.messages.create(params);
    expect(res.usage.input_tokens).toBe(300);

    expect(db.events).toEqual(["reserve_shared_ai_tokens", "create", "settle_shared_ai_tokens"]);
    const estimate = expectedEstimate(params);
    expect(rpcNamed("reserve_shared_ai_tokens")[0].args).toMatchObject({ p_org: ORG, p_tokens: estimate });
    expect(rpcNamed("settle_shared_ai_tokens")[0].args).toEqual({
      p_org: ORG,
      p_day: "2026-10-01",
      p_delta: 500 - estimate,
    });
  });

  it("caps max_tokens at 8192 for env calls instead of failing", async () => {
    expect(SHARED_MAX_OUTPUT_TOKENS).toBe(8192);
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG);
    await client.messages.create({ ...params, max_tokens: 20_000 });
    expect(sdk.params[0].max_tokens).toBe(8192);
    expect(rpcNamed("reserve_shared_ai_tokens")[0].args.p_tokens).toBe(
      expectedEstimate({ ...params, max_tokens: 8192 })
    );
  });

  it("keeps the whole reservation when the provider call fails", async () => {
    sdk.create = async () => {
      throw new Error("529 overloaded");
    };
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG);
    await expect(client.messages.create(params)).rejects.toThrow("529 overloaded");
    expect(db.events).toEqual(["reserve_shared_ai_tokens", "create"]);
  });

  it("never reserves, settles or caps for the org's own credential", async () => {
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...envAnthropic, source: "org" }, null, ORG);
    await client.messages.create({ ...params, max_tokens: 20_000 });
    expect(db.rpcCalls).toHaveLength(0);
    expect(sdk.params[0].max_tokens).toBe(20_000);
  });
});
