// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fake Supabase admin client: records every query and answers ai_usage_log
// page reads from `pages`, keyed by "org" (organization filter) or "site".
// ---------------------------------------------------------------------------

type Call = { table: string; ops: Array<[string, ...unknown[]]> };
type PageResult = { data: Array<{ total_tokens: number | null }> | null; error: { message: string } | null };

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  pages: { org: [] as PageResult[], site: [] as PageResult[] },
  inserts: [] as Array<Record<string, unknown>>,
  profiles: [] as Array<{ id: string }>,
  sessionUserId: null as string | null,
  adminThrows: false,
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
  builder.range = (from: number, to: number) => {
    call.ops.push(["range", from, to]);
    const key = call.ops.some(([op, col]) => op === "eq" && col === "organization_id") ? "org" : "site";
    return Promise.resolve(db.pages[key].shift() ?? { data: [], error: null });
  };
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

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    if (db.adminThrows) throw new Error("no service role");
    return { from: fakeQuery };
  },
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: db.sessionUserId ? { id: db.sessionUserId } : null } }),
    },
  }),
}));

const core = await import("@/lib/ai/shared-budget-core");
const { checkSharedBudget, recordSharedUsage } = await import("@/lib/ai/shared-budget");

const {
  DEFAULT_SHARED_DAILY_TOKEN_LIMIT,
  DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT,
  SHARED_BUDGET_BUSY_REASON,
  SHARED_BUDGET_WORKSPACE_REASON,
  SharedBudgetError,
  parseLimit,
  sharedBudgetDecision,
  sharedBudgetLimits,
  utcDayStart,
} = core;

const ORG = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-01T15:30:00Z");

function rows(...tokens: Array<number | null>): PageResult {
  return { data: tokens.map((t) => ({ total_tokens: t })), error: null };
}

beforeEach(() => {
  db.calls = [];
  db.pages = { org: [], site: [] };
  db.inserts = [];
  db.profiles = [];
  db.sessionUserId = null;
  db.adminThrows = false;
  delete process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT;
  delete process.env.AI_SHARED_DAILY_TOKEN_LIMIT;
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

describe("sharedBudgetDecision", () => {
  const limits = { orgLimit: 100, siteLimit: 1000 };

  it("allows a call while both totals are under their limits", () => {
    expect(sharedBudgetDecision({ ...limits, orgTokensToday: 99, siteTokensToday: 999 })).toEqual({
      allowed: true,
    });
    expect(sharedBudgetDecision({ ...limits, orgTokensToday: 0, siteTokensToday: 0 })).toEqual({ allowed: true });
  });

  it("blocks the workspace once it reaches its own limit", () => {
    expect(sharedBudgetDecision({ ...limits, orgTokensToday: 100, siteTokensToday: 100 })).toEqual({
      allowed: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
  });

  it("blocks everyone with the busy reason once the site-wide limit is reached", () => {
    expect(sharedBudgetDecision({ ...limits, orgTokensToday: 0, siteTokensToday: 1000 })).toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
  });

  it("names the workspace limit when both are used up", () => {
    expect(sharedBudgetDecision({ ...limits, orgTokensToday: 500, siteTokensToday: 5000 }).reason).toBe(
      SHARED_BUDGET_WORKSPACE_REASON
    );
  });

  it("treats a limit of 0 as no shared AI at all", () => {
    expect(sharedBudgetDecision({ orgLimit: 0, siteLimit: 1000, orgTokensToday: 0, siteTokensToday: 0 })).toEqual({
      allowed: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
    expect(sharedBudgetDecision({ orgLimit: 100, siteLimit: 0, orgTokensToday: 0, siteTokensToday: 0 })).toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
  });
});

describe("utcDayStart", () => {
  it("returns midnight UTC of the current UTC day", () => {
    expect(utcDayStart(new Date("2026-10-01T23:30:00+05:00")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    // 02:00 in UTC+6 is still 30 September in UTC.
    expect(utcDayStart(new Date("2026-10-01T02:00:00+06:00")).toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-10-01T00:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("checkSharedBudget", () => {
  it("sums today's shared-key tokens for the workspace and site-wide", async () => {
    db.pages.org = [rows(10, 20, null)];
    db.pages.site = [rows(10, 20, 300)];

    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({ allowed: true });

    const usage = db.calls.filter((c) => c.table === "ai_usage_log");
    expect(usage).toHaveLength(2);
    for (const call of usage) {
      expect(call.ops).toContainEqual(["select", "total_tokens"]);
      expect(call.ops).toContainEqual(["eq", "metadata->>shared_key", "true"]);
      expect(call.ops).toContainEqual(["gte", "created_at", "2026-10-01T00:00:00.000Z"]);
    }
    const orgFiltered = usage.filter((c) => c.ops.some(([op, col]) => op === "eq" && col === "organization_id"));
    expect(orgFiltered).toHaveLength(1);
    expect(orgFiltered[0].ops).toContainEqual(["eq", "organization_id", ORG]);
  });

  it("blocks the workspace when its shared tokens reach AI_SHARED_ORG_DAILY_TOKEN_LIMIT", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "100";
    db.pages.org = [rows(60, 40)];
    db.pages.site = [rows(60, 40)];
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
  });

  it("blocks with the busy reason when the site-wide total reaches AI_SHARED_DAILY_TOKEN_LIMIT", async () => {
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "500";
    db.pages.org = [rows(5)];
    db.pages.site = [rows(5, 495)];
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
  });

  it("reads further pages when a page is full, so large days are not undercounted", async () => {
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "1500";
    const fullPage = rows(...Array.from({ length: 1000 }, () => 1));
    db.pages.org = [rows(1)];
    db.pages.site = [fullPage, rows(500)];
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
    const siteCalls = db.calls.filter(
      (c) => c.table === "ai_usage_log" && !c.ops.some(([op, col]) => op === "eq" && col === "organization_id")
    );
    expect(siteCalls.map((c) => c.ops.find(([op]) => op === "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  it("stops reading once the limit is already reached", async () => {
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "10";
    db.pages.org = [rows(1)];
    db.pages.site = [rows(...Array.from({ length: 1000 }, () => 1)), rows(1)];
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
    expect(db.pages.site).toHaveLength(1); // second page never requested
  });

  it("fails closed with the busy reason when a query errors", async () => {
    db.pages.org = [{ data: null, error: { message: "boom" } }];
    db.pages.site = [rows(0)];
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
  });

  it("fails closed with the busy reason when the database is unreachable", async () => {
    db.adminThrows = true;
    await expect(checkSharedBudget(ORG, NOW)).resolves.toEqual({
      allowed: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
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

describe("createAIMessagesClient shared-key gate", () => {
  // A custom endpoint on a non-public URL: any call that gets past the budget
  // gate fails at URL validation, before any network request.
  const blocked = { provider: "custom" as const, apiKey: "test-only-key", baseURL: "http://localhost" };
  const params = { model: "claude-sonnet-4.6", max_tokens: 16, messages: [{ role: "user" as const, content: "hi" }] };
  const budgetQueries = () => db.calls.filter((c) => c.table === "ai_usage_log");

  it("refuses an env-credential call when no org is given to charge (fail closed)", async () => {
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...blocked, source: "env" });
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_BUSY_REASON);
    expect(budgetQueries()).toHaveLength(0);
  });

  it("refuses an env-credential call once the workspace budget is used up", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "100";
    db.pages.org = [rows(100)];
    db.pages.site = [rows(100)];
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...blocked, source: "env" }, null, ORG);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_WORKSPACE_REASON);
  });

  it("lets an env-credential call through while budget remains", async () => {
    db.pages.org = [rows(1)];
    db.pages.site = [rows(1)];
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...blocked, source: "env" }, null, ORG);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(SharedBudgetError);
    expect(budgetQueries()).toHaveLength(2);
  });

  it("never checks the shared budget for the org's own credential", async () => {
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...blocked, source: "org" }, null, ORG);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(SharedBudgetError);
    expect(budgetQueries()).toHaveLength(0);
  });
});
