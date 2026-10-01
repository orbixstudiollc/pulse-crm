import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "org-123";
const USER = "user-456";

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };

const queries: Query[] = [];
let activeCount = 0;
let isAnonymous = false;

// Chainable fake: records calls; the count query resolves to activeCount, the insert to a new row.
function makeBuilder(query: Query) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "insert", "eq"]) {
    builder[m] = (...args: unknown[]) => {
      query.calls.push({ method: m, args });
      return builder;
    };
  }
  builder.single = () => {
    query.calls.push({ method: "single", args: [] });
    return Promise.resolve({ data: { id: "task-1" }, error: null });
  };
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, count: activeCount }).then(resolve, reject);
  return builder;
}

const fakeClient = {
  from: (table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    return makeBuilder(query);
  },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/actions/helpers", () => ({
  getOrgId: async () => ORG,
  getCurrentUserProfile: async () => ({ user: { id: USER, is_anonymous: isAnonymous }, profile: {} }),
}));

import { createTaskFromPrompt } from "@/lib/actions/copilot-tasks";

const valid = { title: "Weekly pipeline", prompt: "Summarise my pipeline", schedule: "daily" as const };
const insertOf = (q: Query) => q.calls.find((c) => c.method === "insert")?.args[0] as Record<string, unknown> | undefined;

beforeEach(() => {
  queries.length = 0;
  activeCount = 0;
  isAnonymous = false;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T15:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("createTaskFromPrompt", () => {
  it("rejects a guest's second task with task_cap and inserts nothing", async () => {
    isAnonymous = true;
    activeCount = 1;
    const res = await createTaskFromPrompt(valid);
    expect(res).toEqual({ ok: false, error: "task_cap" });
    expect(queries.some((q) => insertOf(q))).toBe(false);
  });

  it("allows a guest's first task", async () => {
    isAnonymous = true;
    activeCount = 0;
    const res = await createTaskFromPrompt(valid);
    expect(res.ok).toBe(true);
  });

  it("rejects a non-guest's fourth task with task_cap", async () => {
    activeCount = 3;
    const res = await createTaskFromPrompt(valid);
    expect(res).toEqual({ ok: false, error: "task_cap" });
    expect(queries.some((q) => insertOf(q))).toBe(false);
  });

  it("allows a non-guest's third task", async () => {
    activeCount = 2;
    const res = await createTaskFromPrompt(valid);
    expect(res.ok).toBe(true);
  });

  it("returns invalid for an empty prompt and never touches the database", async () => {
    const res = await createTaskFromPrompt({ ...valid, prompt: "   " });
    expect(res).toEqual({ ok: false, error: "invalid" });
    expect(queries).toHaveLength(0);
  });

  it("returns invalid for an empty title, an oversize prompt and an unsupported schedule", async () => {
    expect(await createTaskFromPrompt({ ...valid, title: "" })).toEqual({ ok: false, error: "invalid" });
    expect(await createTaskFromPrompt({ ...valid, prompt: "x".repeat(4001) })).toEqual({ ok: false, error: "invalid" });
    expect(await createTaskFromPrompt({ ...valid, schedule: "custom" as never })).toEqual({ ok: false, error: "invalid" });
  });

  it("sets next_run_at to 00:00 UTC the next day and scopes the insert by organization", async () => {
    const res = await createTaskFromPrompt(valid);
    expect(res).toEqual({ ok: true, id: "task-1", nextRunAt: "2026-10-02T00:00:00.000Z" });

    const count = queries[0];
    expect(count.calls).toContainEqual({ method: "eq", args: ["organization_id", ORG] });
    expect(count.calls).toContainEqual({ method: "eq", args: ["is_active", true] });

    const row = insertOf(queries[1]);
    expect(row).toMatchObject({
      organization_id: ORG,
      user_id: USER,
      title: "Weekly pipeline",
      prompt: "Summarise my pipeline",
      schedule: "daily",
      is_active: true,
      next_run_at: "2026-10-02T00:00:00.000Z",
    });
  });
});
