import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "org-123";
const USER = "user-456";

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };

const queries: Query[] = [];
/** Per-table count the fake resolves to; a table listed in failing resolves with an error. */
let counts: Record<string, number> = {};
let failing = new Set<string>();
let user: { id: string } | null = { id: USER };

// Chainable fake: records every call; awaiting a chain resolves its table's count (head-only).
function makeBuilder(query: Query) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "lt", "not", "or", "in"]) {
    builder[m] = (...args: unknown[]) => {
      query.calls.push({ method: m, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(
      failing.has(query.table)
        ? { data: null, count: null, error: { message: "boom" } }
        : { data: null, count: counts[query.table] ?? 0, error: null },
    ).then(resolve, reject);
  return builder;
}

const fakeClient = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    return makeBuilder(query);
  },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => ORG }));

import { getAssistantBrief } from "@/lib/actions/copilot-brief";

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.calls.some((c) => c.method === method && args.every((a, i) => c.args[i] === a));

beforeEach(() => {
  queries.length = 0;
  counts = { leads: 2, deals: 5, copilot_approvals: 1 };
  failing = new Set();
  user = { id: USER };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T15:30:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getAssistantBrief", () => {
  it("filters every query chain by organization_id and counts head-only", async () => {
    await getAssistantBrief();

    expect(queries).toHaveLength(6);
    for (const q of queries) {
      expect(has(q, "eq", "organization_id", ORG), `${q.table} is org-scoped`).toBe(true);
      const select = q.calls.find((c) => c.method === "select");
      expect(select?.args[1]).toEqual({ count: "exact", head: true });
    }
  });

  it("returns each count, using next_followup, last_contacted_at, deal stage/updated_at and the caller's pending task approvals", async () => {
    const brief = await getAssistantBrief();

    expect(brief).toEqual({ followupsDueToday: 2, overdueFollowups: 2, hotLeadsUntouched: 4, staleDeals: 5, pendingApprovals: 1 });
    const leads = queries.filter((q) => q.table === "leads");
    expect(leads.every((q) => has(q, "is", "converted_at", null))).toBe(true);
    expect(leads.some((q) => has(q, "eq", "next_followup", "2026-10-01"))).toBe(true);
    expect(leads.some((q) => has(q, "lt", "next_followup", "2026-10-01"))).toBe(true);
    // Untouched hot leads = never contacted + contacted before the cutoff, as two plain counts.
    const hot = leads.filter((q) => has(q, "eq", "status", "hot"));
    expect(hot).toHaveLength(2);
    expect(hot.some((q) => has(q, "is", "last_contacted_at", null))).toBe(true);
    expect(hot.some((q) => has(q, "lt", "last_contacted_at", "2026-09-24T15:30:00.000Z"))).toBe(true);
    expect(hot.every((q) => !q.calls.some((c) => c.method === "or"))).toBe(true);
    const deals = queries.find((q) => q.table === "deals")!;
    expect(has(deals, "not", "stage", "in", "(closed_won,closed_lost)")).toBe(true);
    expect(has(deals, "lt", "updated_at", "2026-09-17T15:30:00.000Z")).toBe(true);
    const approvals = queries.find((q) => q.table === "copilot_approvals")!;
    expect(has(approvals, "eq", "user_id", USER)).toBe(true);
    expect(has(approvals, "eq", "status", "pending")).toBe(true);
    expect(has(approvals, "eq", "source", "task")).toBe(true);
  });

  it("a failed query leaves only its own field null", async () => {
    failing = new Set(["deals"]);

    const brief = await getAssistantBrief();

    expect(brief.staleDeals).toBeNull();
    expect(brief.followupsDueToday).toBe(2);
    expect(brief.pendingApprovals).toBe(1);
  });

  it("without a signed-in user the approvals count is null and not queried", async () => {
    user = null;

    const brief = await getAssistantBrief();

    expect(brief.pendingApprovals).toBeNull();
    expect(queries.some((q) => q.table === "copilot_approvals")).toBe(false);
  });
});
