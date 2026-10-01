// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fake Supabase admin client: records rpc calls (answered from `rpcResults`),
// the profiles lookups (recordSharedUsage's first member, sharedCallerIsGuest's
// member ids), the auth admin lookups (sharedCallerIsGuest's is_anonymous) and
// the ai_usage_log insert. A fake Anthropic SDK records
// provider calls, so the order reserve -> call -> settle can be checked
// without a network.
// ---------------------------------------------------------------------------

type Call = { table: string; ops: Array<[string, ...unknown[]]> };
type RpcResult = { data: unknown; error: { message: string } | null } | "reject";

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResults: {} as Record<string, RpcResult[]>,
  inserts: [] as Array<Record<string, unknown>>,
  profiles: [] as Array<{ id: string }>,
  members: [] as Array<{ id: string; email?: string | null }>,
  membersError: null as { message: string } | null,
  /** auth.admin.getUserById answers by user id; a missing id is "not found". */
  authUsers: {} as Record<string, { is_anonymous?: boolean } | "error" | "reject">,
  authLookups: [] as string[],
  session: null as { id: string; is_anonymous?: boolean } | null,
  sessionThrows: false,
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
  // Awaiting the builder itself lists rows: the workspace's members.
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(
      db.membersError ? { data: null, error: db.membersError } : { data: db.members, error: null }
    ).then(resolve, reject);
  builder.insert = (row: Record<string, unknown>) => {
    db.inserts.push(row);
    return Promise.resolve({ error: null });
  };
  return builder;
}

function fakeGetUserById(id: string) {
  db.authLookups.push(id);
  const user = db.authUsers[id];
  if (user === "reject") return Promise.reject(new Error("auth down"));
  if (user === "error") return Promise.resolve({ data: { user: null }, error: { message: "auth error" } });
  if (!user) return Promise.resolve({ data: { user: null }, error: { message: "User not found" } });
  return Promise.resolve({ data: { user: { id, ...user } }, error: null });
}

function fakeRpc(fn: string, args: Record<string, unknown>) {
  db.rpcCalls.push({ fn, args });
  db.events.push(fn);
  const fallback =
    fn === "reserve_shared_ai_tokens" ? { data: [{ result: "ok", day: "2026-10-01" }], error: null } : { data: null, error: null };
  const next = db.rpcResults[fn]?.shift() ?? fallback;
  if (next === "reject") return Promise.reject(new Error("network down"));
  return Promise.resolve(next);
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    if (db.adminThrows) throw new Error("no service role");
    return { from: fakeQuery, rpc: fakeRpc, auth: { admin: { getUserById: fakeGetUserById } } };
  },
  createClient: async () => {
    if (db.sessionThrows) throw new Error("cookies() called outside a request scope");
    return { auth: { getUser: async () => ({ data: { user: db.session } }) } };
  },
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
const { reserveSharedTokens, settleSharedTokens, recordSharedUsage, sharedCallerIsGuest, sharedTurnBudget } =
  await import("@/lib/ai/shared-budget");

const {
  DEFAULT_SHARED_DAILY_TOKEN_LIMIT,
  DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT,
  SHARED_BUDGET_BUSY_REASON,
  SHARED_BUDGET_TOO_LARGE_REASON,
  SHARED_BUDGET_WORKSPACE_REASON,
  SHARED_MAX_OUTPUT_TOKENS,
  SharedBudgetError,
  estimateTokens,
  parseLimit,
  reservationFromRpc,
  settlementDelta,
  settlementsByDay,
  sharedBudgetLimits,
} = core;

const ORG = "11111111-1111-4111-8111-111111111111";
// Deliberately a different UTC day from the one the fake RPC reports, so the
// tests prove the day comes from the database, not from the server clock.
const NOW = new Date("2026-10-02T00:00:01Z");
const LIMIT_ENV = ["AI_SHARED_ORG_DAILY_TOKEN_LIMIT", "AI_SHARED_DAILY_TOKEN_LIMIT", "AI_SHARED_GUEST_DAILY_TOKEN_LIMIT"];

beforeEach(() => {
  db.calls = [];
  db.rpcCalls = [];
  db.rpcResults = {};
  db.inserts = [];
  db.profiles = [];
  db.members = [];
  db.membersError = null;
  db.authUsers = {};
  db.authLookups = [];
  db.session = null;
  db.sessionThrows = false;
  db.adminThrows = false;
  db.events = [];
  sdk.create = null;
  sdk.params = [];
  for (const key of LIMIT_ENV) delete process.env[key];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
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
    expect(SHARED_BUDGET_TOO_LARGE_REASON).toBe(
      "This request is too large for the shared AI allowance. Shorten it or add your own AI provider in Settings → AI Assistant."
    );
  });

  it("SharedBudgetError carries the reason as its message", () => {
    const err = new SharedBudgetError(SHARED_BUDGET_BUSY_REASON);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SharedBudgetError");
    expect(err.message).toBe(SHARED_BUDGET_BUSY_REASON);
  });
});

describe("parseLimit", () => {
  it("uses the default when the variable is unset or blank", () => {
    expect(parseLimit(undefined, 50_000, "LIMIT_A")).toBe(50_000);
    expect(parseLimit("", 50_000, "LIMIT_A")).toBe(50_000);
    expect(parseLimit("   ", 50_000, "LIMIT_A")).toBe(50_000);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reads a whole non-negative number, ignoring surrounding spaces", () => {
    expect(parseLimit("2500", 50_000, "LIMIT_B")).toBe(2500);
    expect(parseLimit(" 1000000 ", 50_000, "LIMIT_B")).toBe(1_000_000);
    expect(parseLimit("0", 50_000, "LIMIT_B")).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("turns shared AI off (0) when the variable is set to anything else, never the larger default", () => {
    for (const bad of ["20,000", "-5", "abc", "1.5", "1e6", "12abc", "Infinity", "NaN", "0x10", "99999999999999999999"]) {
      expect(parseLimit(bad, 50_000, "LIMIT_C")).toBe(0);
    }
  });

  it("warns once per variable, naming it but never echoing the value", () => {
    parseLimit("20,000", 50_000, "LIMIT_D");
    parseLimit("20,000", 50_000, "LIMIT_D");
    parseLimit("oops", 50_000, "LIMIT_E");
    expect(console.warn).toHaveBeenCalledTimes(2);
    const messages = vi.mocked(console.warn).mock.calls.map((args) => args.join(" "));
    expect(messages[0]).toContain("LIMIT_D");
    expect(messages[1]).toContain("LIMIT_E");
    for (const message of messages) {
      expect(message).not.toContain("20,000");
      expect(message).not.toContain("oops");
    }
  });
});

describe("sharedBudgetLimits", () => {
  it("defaults to 50,000 per workspace, 1,000,000 site-wide and half the site limit for guests", () => {
    expect(DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT).toBe(50_000);
    expect(DEFAULT_SHARED_DAILY_TOKEN_LIMIT).toBe(1_000_000);
    expect(sharedBudgetLimits({})).toEqual({ orgLimit: 50_000, siteLimit: 1_000_000, guestLimit: 500_000 });
    expect(sharedBudgetLimits({ AI_SHARED_DAILY_TOKEN_LIMIT: "300001" }).guestLimit).toBe(150_000);
  });

  it("reads all three variables", () => {
    expect(
      sharedBudgetLimits({
        AI_SHARED_ORG_DAILY_TOKEN_LIMIT: "10",
        AI_SHARED_DAILY_TOKEN_LIMIT: "20",
        AI_SHARED_GUEST_DAILY_TOKEN_LIMIT: "5",
      })
    ).toEqual({ orgLimit: 10, siteLimit: 20, guestLimit: 5 });
  });

  it("a malformed value turns that limit off", () => {
    expect(sharedBudgetLimits({ AI_SHARED_ORG_DAILY_TOKEN_LIMIT: "20,000" }).orgLimit).toBe(0);
    expect(sharedBudgetLimits({ AI_SHARED_GUEST_DAILY_TOKEN_LIMIT: "lots" }).guestLimit).toBe(0);
    // A malformed site limit is 0, so the default guest pool (half of it) is 0 too.
    expect(sharedBudgetLimits({ AI_SHARED_DAILY_TOKEN_LIMIT: "1m" })).toMatchObject({ siteLimit: 0, guestLimit: 0 });
  });
});

describe("estimateTokens", () => {
  it("counts a third of the ASCII characters, rounded up, plus the output cap", () => {
    expect(estimateTokens({ input: "", maxOutputTokens: 1024 })).toBe(1024);
    expect(estimateTokens({ input: "abc", maxOutputTokens: 1024 })).toBe(1025);
    expect(estimateTokens({ input: "abcd", maxOutputTokens: 1024 })).toBe(1026);
    expect(estimateTokens({ input: "x".repeat(30_000), maxOutputTokens: 4096 })).toBe(14_096);
  });

  it("counts every non-ASCII character as a whole token (CJK)", () => {
    // 6 CJK characters: 6 tokens, not 6 / 3 = 2.
    expect(estimateTokens({ input: "你好世界こん", maxOutputTokens: 0 })).toBe(6);
    expect(estimateTokens({ input: "한국어".repeat(1000), maxOutputTokens: 0 })).toBe(3000);
  });

  it("counts an emoji as one token per code point, and mixes with ASCII", () => {
    expect(estimateTokens({ input: "👍", maxOutputTokens: 0 })).toBe(1);
    // man + ZWJ + woman + ZWJ + girl: 5 code points.
    expect(estimateTokens({ input: "👨‍👩‍👧", maxOutputTokens: 0 })).toBe(5);
    // 4 ASCII characters ("hi " and "!") round up to 2, plus 2 accented letters.
    expect(estimateTokens({ input: "hi éé!", maxOutputTokens: 10 })).toBe(2 + 2 + 10);
  });

  it("is deterministic", () => {
    const input = "Lead: 山田太郎 🚀 score 87";
    expect(estimateTokens({ input, maxOutputTokens: 7 })).toBe(estimateTokens({ input, maxOutputTokens: 7 }));
  });
});

describe("reservationFromRpc", () => {
  it("accepts the reservation with the day the database charged", () => {
    expect(reservationFromRpc([{ result: "ok", day: "2026-09-30" }], 500)).toEqual({
      ok: true,
      day: "2026-09-30",
      reserved: 500,
    });
  });

  it("maps the workspace limit to the workspace reason", () => {
    expect(reservationFromRpc([{ result: "org_limit", day: "2026-09-30" }], 5)).toEqual({
      ok: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
  });

  it("maps the guest pool and the site-wide limit to the busy reason", () => {
    for (const result of ["guest_limit", "site_limit"]) {
      expect(reservationFromRpc([{ result, day: "2026-09-30" }], 5)).toEqual({
        ok: false,
        reason: SHARED_BUDGET_BUSY_REASON,
      });
    }
  });

  it("refuses anything unexpected (fail closed), including 'ok' without a usable day", () => {
    const busy = { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
    for (const data of [
      "ok",
      null,
      undefined,
      [],
      [{ result: "OK", day: "2026-09-30" }],
      [{ result: "ok" }],
      [{ result: "ok", day: null }],
      [{ result: "ok", day: "30/09/2026" }],
      [{ result: "ok", day: "2026-09-30" }, { result: "ok", day: "2026-09-30" }],
      { result: "ok", day: "2026-09-30" },
    ]) {
      expect(reservationFromRpc(data, 5)).toEqual(busy);
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
  });

  it("is null when actual usage is unknown, so the reservation stands", () => {
    for (const actual of [undefined, null, Number.NaN, Infinity, -5, 0]) {
      expect(settlementDelta(1000, actual)).toBeNull();
    }
  });
});

describe("settlementsByDay", () => {
  it("combines a turn's reservations on one day into one settlement with total usage", () => {
    expect(
      settlementsByDay(
        [
          { day: "2026-10-01", reserved: 5000 },
          { day: "2026-10-01", reserved: 6000 },
        ],
        [1200, 1800]
      )
    ).toEqual([{ day: "2026-10-01", reserved: 11_000, actual: 3000 }]);
  });

  it("settles each UTC day against the steps reserved on it", () => {
    expect(
      settlementsByDay(
        [
          { day: "2026-09-30", reserved: 5000 },
          { day: "2026-10-01", reserved: 6000 },
          { day: "2026-10-01", reserved: 7000 },
        ],
        [100, 200, 300]
      )
    ).toEqual([
      { day: "2026-09-30", reserved: 5000, actual: 100 },
      { day: "2026-10-01", reserved: 13_000, actual: 500 },
    ]);
  });

  it("leaves a reservation with unknown usage (or no step) out, so it stands in full", () => {
    expect(
      settlementsByDay(
        [
          { day: "2026-10-01", reserved: 5000 },
          { day: "2026-10-01", reserved: 6000 },
          { day: "2026-10-01", reserved: 7000 },
        ],
        [1000, undefined]
      )
    ).toEqual([{ day: "2026-10-01", reserved: 5000, actual: 1000 }]);
    expect(settlementsByDay([{ day: "2026-10-01", reserved: 5000 }], [0])).toEqual([]);
    expect(settlementsByDay([], [])).toEqual([]);
  });
});

describe("reserveSharedTokens", () => {
  it("reserves against all limits and returns the day the database charged", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "ok", day: "2026-10-01" }], error: null }];
    await expect(reserveSharedTokens(ORG, 1234, { isGuest: false })).resolves.toEqual({
      ok: true,
      day: "2026-10-01",
      reserved: 1234,
    });
    expect(db.rpcCalls).toEqual([
      {
        fn: "reserve_shared_ai_tokens",
        args: {
          p_org: ORG,
          p_tokens: 1234,
          p_org_limit: 50_000,
          p_site_limit: 1_000_000,
          p_is_guest: false,
          p_guest_limit: 500_000,
        },
      },
    ]);
  });

  it("charges guests to the guest pool too", async () => {
    await reserveSharedTokens(ORG, 10, { isGuest: true });
    expect(db.rpcCalls[0].args).toMatchObject({ p_is_guest: true, p_guest_limit: 500_000 });
  });

  it("passes the limits from env (the owner sets them in Vercel)", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "20000";
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "300000";
    process.env.AI_SHARED_GUEST_DAILY_TOKEN_LIMIT = "60000";
    await reserveSharedTokens(ORG, 10, { isGuest: true });
    expect(db.rpcCalls[0].args).toMatchObject({ p_org_limit: 20_000, p_site_limit: 300_000, p_guest_limit: 60_000 });
  });

  it("refuses a request larger than the workspace limit itself without reserving", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "20000";
    await expect(reserveSharedTokens(ORG, 20_001, { isGuest: false })).resolves.toEqual({
      ok: false,
      reason: SHARED_BUDGET_TOO_LARGE_REASON,
    });
    expect(db.rpcCalls).toHaveLength(0);
    // Exactly the limit may still fit on an unused day.
    await reserveSharedTokens(ORG, 20_000, { isGuest: false });
    expect(db.rpcCalls).toHaveLength(1);
  });

  it("refuses with the workspace reason when the workspace limit would be passed", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "org_limit", day: "2026-10-01" }], error: null }];
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual({
      ok: false,
      reason: SHARED_BUDGET_WORKSPACE_REASON,
    });
  });

  it("refuses with the busy reason when the guest pool or the site-wide limit would be passed", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [
      { data: [{ result: "guest_limit", day: "2026-10-01" }], error: null },
      { data: [{ result: "site_limit", day: "2026-10-01" }], error: null },
    ];
    const busy = { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
    await expect(reserveSharedTokens(ORG, 10, { isGuest: true })).resolves.toEqual(busy);
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual(busy);
  });

  it("fails closed with the busy reason on an RPC error, a rejection or no database", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: null, error: { message: "boom" } }, "reject"];
    const busy = { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual(busy);
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual(busy);
    db.adminThrows = true;
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual(busy);
  });

  it("refuses when the shared AI is off because a limit is malformed", async () => {
    process.env.AI_SHARED_DAILY_TOKEN_LIMIT = "1,000,000";
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "site_limit", day: "2026-10-01" }], error: null }];
    await expect(reserveSharedTokens(ORG, 10, { isGuest: false })).resolves.toEqual({
      ok: false,
      reason: SHARED_BUDGET_BUSY_REASON,
    });
    expect(db.rpcCalls[0].args).toMatchObject({ p_site_limit: 0, p_guest_limit: 0 });
  });
});

describe("settleSharedTokens", () => {
  it("corrects the reservation to actual usage on the reservation's day, in the same pool", async () => {
    await settleSharedTokens(ORG, "2026-09-30", 1000, 1500, { isGuest: false });
    await settleSharedTokens(ORG, "2026-09-30", 1000, 300, { isGuest: true });
    expect(db.rpcCalls).toEqual([
      { fn: "settle_shared_ai_tokens", args: { p_org: ORG, p_day: "2026-09-30", p_delta: 500, p_is_guest: false } },
      { fn: "settle_shared_ai_tokens", args: { p_org: ORG, p_day: "2026-09-30", p_delta: -700, p_is_guest: true } },
    ]);
  });

  it("skips settling when usage is unknown or matches the reservation", async () => {
    await settleSharedTokens(ORG, "2026-10-01", 1000, undefined, { isGuest: false });
    await settleSharedTokens(ORG, "2026-10-01", 1000, 0, { isGuest: false });
    await settleSharedTokens(ORG, "2026-10-01", 1000, 1000, { isGuest: false });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("never throws", async () => {
    db.rpcResults.settle_shared_ai_tokens = [{ data: null, error: { message: "boom" } }, "reject"];
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10, { isGuest: false })).resolves.toBeUndefined();
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10, { isGuest: false })).resolves.toBeUndefined();
    db.adminThrows = true;
    await expect(settleSharedTokens(ORG, "2026-10-01", 1000, 10, { isGuest: false })).resolves.toBeUndefined();
  });
});

describe("sharedCallerIsGuest", () => {
  const memberQueries = () => db.calls.filter((c) => c.table === "profiles");

  it("uses the session user when there is one: anonymous is a guest", async () => {
    db.session = { id: "u1", is_anonymous: true };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.session = { id: "u2", is_anonymous: false };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(false);
    db.session = { id: "u3" };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(false);
    expect(memberQueries()).toHaveLength(0);
    expect(db.authLookups).toHaveLength(0);
  });

  it("without a session, a workspace whose members are all non-anonymous auth users is not a guest", async () => {
    db.members = [{ id: "owner" }, { id: "rep" }];
    db.authUsers = { owner: { is_anonymous: false }, rep: {} };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(false);
    expect(memberQueries()[0].ops).toContainEqual(["eq", "organization_id", ORG]);
    expect([...db.authLookups].sort()).toEqual(["owner", "rep"]);
  });

  it("without a session, a workspace with any anonymous member is a guest", async () => {
    db.members = [{ id: "owner" }, { id: "anon" }];
    db.authUsers = { owner: { is_anonymous: false }, anon: { is_anonymous: true } };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
  });

  it("decides from auth, not the profile email a guest can edit", async () => {
    // A guest who PATCHed profiles.email to a real-looking address stays a guest.
    db.members = [{ id: "anon", email: "owner@acme.com" }];
    db.authUsers = { anon: { is_anonymous: true } };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    // And a non-anonymous user is not a guest whatever the email says.
    db.members = [{ id: "real", email: "abc123@guest.local" }];
    db.authUsers = { real: { is_anonymous: false } };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(false);
    expect(memberQueries()[0].ops).toContainEqual(["select", "id"]);
  });

  it("falls back to the members when there is no request scope", async () => {
    db.sessionThrows = true;
    db.members = [{ id: "owner" }];
    db.authUsers = { owner: { is_anonymous: false } };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(false);
  });

  it("treats the caller as a guest when it cannot be determined (smaller pool)", async () => {
    db.authUsers = { owner: { is_anonymous: false } };
    db.members = [];
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.members = [{ id: "owner" }, { id: "missing" }];
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.authUsers = { owner: { is_anonymous: false }, broken: "error" };
    db.members = [{ id: "owner" }, { id: "broken" }];
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.authUsers = { owner: { is_anonymous: false }, down: "reject" };
    db.members = [{ id: "owner" }, { id: "down" }];
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.members = [{ id: "owner" }];
    db.membersError = { message: "boom" };
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
    db.membersError = null;
    db.adminThrows = true;
    await expect(sharedCallerIsGuest(ORG)).resolves.toBe(true);
  });
});

describe("sharedTurnBudget (chat: one reservation per step)", () => {
  const base = { orgId: ORG, isGuest: true, baseInput: "x".repeat(300), maxOutputTokens: 4096, maxSteps: 3 };
  const step = (messages: unknown[], usage?: { inputTokens?: number; outputTokens?: number }) => ({
    response: { messages },
    usage: usage ?? { inputTokens: undefined, outputTokens: undefined },
  });
  const reserves = () => db.rpcCalls.filter((c) => c.fn === "reserve_shared_ai_tokens");
  const settles = () => db.rpcCalls.filter((c) => c.fn === "settle_shared_ai_tokens");

  it("reserves only the first step up front: its input plus one output cap", async () => {
    const turn = sharedTurnBudget(base);
    await expect(turn.start()).resolves.toMatchObject({ ok: true });
    expect(reserves()).toHaveLength(1);
    expect(reserves()[0].args).toMatchObject({ p_org: ORG, p_tokens: 100 + 4096, p_is_guest: true });
  });

  it("before each further step, reserves that step's input (the growing message list) plus one output cap", async () => {
    const turn = sharedTurnBudget(base);
    await turn.start();
    const sent = [{ role: "assistant", content: [{ type: "tool-call", toolName: "lookupLead" }] }];
    await expect(turn.stopWhen({ steps: [step(sent)] })).resolves.toBe(false);
    expect(reserves()[1].args.p_tokens).toBe(estimateTokens({ input: base.baseInput + JSON.stringify(sent), maxOutputTokens: 4096 }));
    expect(reserves()[1].args.p_tokens as number).toBeGreaterThan(100 + 4096);
  });

  it("stops at the step limit without reserving", async () => {
    const turn = sharedTurnBudget(base);
    await turn.start();
    await expect(turn.stopWhen({ steps: [step([]), step([]), step([])] })).resolves.toBe(true);
    expect(reserves()).toHaveLength(1);
  });

  it("stops cleanly (no error) when the next step's reservation is refused", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [
      { data: [{ result: "ok", day: "2026-10-01" }], error: null },
      { data: [{ result: "guest_limit", day: "2026-10-01" }], error: null },
    ];
    const turn = sharedTurnBudget(base);
    await turn.start();
    await expect(turn.stopWhen({ steps: [step([])] })).resolves.toBe(true);
  });

  it("stops when the next step would be larger than the workspace limit, without reserving it", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "5000";
    const turn = sharedTurnBudget(base);
    await turn.start();
    await expect(turn.stopWhen({ steps: [step([{ content: "y".repeat(3000) }])] })).resolves.toBe(true);
    expect(reserves()).toHaveLength(1);
  });

  it("settles every reservation of the turn with the steps' real usage, once", async () => {
    const turn = sharedTurnBudget(base);
    await turn.start();
    await turn.stopWhen({ steps: [step([])] });
    const first = reserves()[0].args.p_tokens as number;
    const second = reserves()[1].args.p_tokens as number;
    const steps = [step([], { inputTokens: 900, outputTokens: 100 }), step([], { inputTokens: 1100, outputTokens: 400 })];
    await turn.settle(steps);
    await turn.settle(steps);
    expect(settles()).toEqual([
      {
        fn: "settle_shared_ai_tokens",
        args: { p_org: ORG, p_day: "2026-10-01", p_delta: 2500 - (first + second), p_is_guest: true },
      },
    ]);
  });

  it("settles each step against the day its reservation was charged to", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [
      { data: [{ result: "ok", day: "2026-09-30" }], error: null },
      { data: [{ result: "ok", day: "2026-10-01" }], error: null },
    ];
    const turn = sharedTurnBudget({ ...base, isGuest: false });
    await turn.start();
    await turn.stopWhen({ steps: [step([])] });
    const [first, second] = reserves().map((c) => c.args.p_tokens as number);
    await turn.settle([step([], { inputTokens: 10, outputTokens: 5 }), step([], { inputTokens: 20, outputTokens: 5 })]);
    expect(settles().map((c) => c.args)).toEqual([
      { p_org: ORG, p_day: "2026-09-30", p_delta: 15 - first, p_is_guest: false },
      { p_org: ORG, p_day: "2026-10-01", p_delta: 25 - second, p_is_guest: false },
    ]);
  });

  it("on abort, settles the steps that finished and keeps the unfinished step's reservation in full", async () => {
    const turn = sharedTurnBudget(base);
    await turn.start();
    await turn.stopWhen({ steps: [step([])] });
    const first = reserves()[0].args.p_tokens as number;
    // onAbort receives only the finished steps: the second step was cut off.
    await turn.settle([step([], { inputTokens: 900, outputTokens: 100 })]);
    expect(settles().map((c) => c.args)).toEqual([
      { p_org: ORG, p_day: "2026-10-01", p_delta: 1000 - first, p_is_guest: true },
    ]);
    // The onFinish that follows an abort does not settle a second time.
    await turn.settle([step([], { inputTokens: 900, outputTokens: 100 })]);
    expect(settles()).toHaveLength(1);
  });

  it("keeps a reservation in full when its step's usage is unknown", async () => {
    const turn = sharedTurnBudget(base);
    await turn.start();
    await turn.settle([step([])]);
    expect(settles()).toHaveLength(0);
  });

  it("settles nothing when the first reservation was refused", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "org_limit", day: "2026-10-01" }], error: null }];
    const turn = sharedTurnBudget(base);
    await expect(turn.start()).resolves.toEqual({ ok: false, reason: SHARED_BUDGET_WORKSPACE_REASON });
    await turn.settle([step([], { inputTokens: 1, outputTokens: 1 })]);
    expect(settles()).toHaveLength(0);
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
    db.session = { id: "user-1" };
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
    estimateTokens({ input: JSON.stringify({ system: p.system, messages: p.messages }), maxOutputTokens: p.max_tokens });
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
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "org_limit", day: "2026-10-01" }], error: null }];
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG, false);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_WORKSPACE_REASON);
    expect(db.events).toEqual(["reserve_shared_ai_tokens"]);
  });

  it("refuses a request larger than the workspace limit without reserving or calling", async () => {
    process.env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT = "1000";
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG, false);
    const err = await client.messages.create(params).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedBudgetError);
    expect((err as Error).message).toBe(SHARED_BUDGET_TOO_LARGE_REASON);
    expect(db.events).toEqual([]);
  });

  it("reserves the estimate first, calls the provider, then settles to actual usage on the charged day", async () => {
    db.rpcResults.reserve_shared_ai_tokens = [{ data: [{ result: "ok", day: "2026-10-01" }], error: null }];
    sdk.create = reply(300, 200);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG, false);
    const res = await client.messages.create(params);
    expect(res.usage.input_tokens).toBe(300);

    expect(db.events).toEqual(["reserve_shared_ai_tokens", "create", "settle_shared_ai_tokens"]);
    const estimate = expectedEstimate(params);
    expect(rpcNamed("reserve_shared_ai_tokens")[0].args).toMatchObject({
      p_org: ORG,
      p_tokens: estimate,
      p_is_guest: false,
    });
    expect(rpcNamed("settle_shared_ai_tokens")[0].args).toEqual({
      p_org: ORG,
      p_day: "2026-10-01",
      p_delta: 500 - estimate,
      p_is_guest: false,
    });
  });

  it("charges and settles a guest caller in the guest pool", async () => {
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    await createAIMessagesClient(envAnthropic, null, ORG, true).messages.create(params);
    expect(rpcNamed("reserve_shared_ai_tokens")[0].args.p_is_guest).toBe(true);
    expect(rpcNamed("settle_shared_ai_tokens")[0].args.p_is_guest).toBe(true);
  });

  it("decides guest from the session when the caller did not say (callAIWithFallback)", async () => {
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    db.session = { id: "anon", is_anonymous: true };
    await createAIMessagesClient(envAnthropic, null, ORG).messages.create(params);
    db.session = { id: "real", is_anonymous: false };
    await createAIMessagesClient(envAnthropic, null, ORG).messages.create(params);
    expect(rpcNamed("reserve_shared_ai_tokens").map((c) => c.args.p_is_guest)).toEqual([true, false]);
    expect(rpcNamed("settle_shared_ai_tokens").map((c) => c.args.p_is_guest)).toEqual([true, false]);
  });

  it("caps max_tokens at 8192 for env calls instead of failing", async () => {
    expect(SHARED_MAX_OUTPUT_TOKENS).toBe(8192);
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient(envAnthropic, null, ORG, false);
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
    const client = createAIMessagesClient(envAnthropic, null, ORG, false);
    await expect(client.messages.create(params)).rejects.toThrow("529 overloaded");
    expect(db.events).toEqual(["reserve_shared_ai_tokens", "create"]);
  });

  it("never reserves, settles or caps for the org's own credential", async () => {
    sdk.create = reply(10, 10);
    const { createAIMessagesClient } = await import("@/lib/ai/client");
    const client = createAIMessagesClient({ ...envAnthropic, source: "org" }, null, ORG);
    await client.messages.create({ ...params, max_tokens: 20_000 });
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.calls).toHaveLength(0);
    expect(sdk.params[0].max_tokens).toBe(20_000);
  });
});
