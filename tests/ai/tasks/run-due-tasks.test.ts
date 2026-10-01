import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mocks: the single-task runner, and the route's other collaborators ──

const fakes = vi.hoisted(() => ({
  runCopilotTask: vi.fn(),
  expireApprovals: vi.fn(),
  purgeExpiredGuests: vi.fn(),
  resetDailyCounters: vi.fn(),
  resetWeeklyCounters: vi.fn(),
  verifyCronRequest: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/ai/tasks/run-task", () => ({ runCopilotTask: fakes.runCopilotTask }));
vi.mock("@/lib/ai/approvals", () => ({ expireApprovals: fakes.expireApprovals }));
vi.mock("@/lib/auth/guest-cleanup", () => ({ purgeExpiredGuests: fakes.purgeExpiredGuests }));
vi.mock("@/lib/linkedin/rate-limiter", () => ({
  resetDailyCounters: fakes.resetDailyCounters,
  resetWeeklyCounters: fakes.resetWeeklyCounters,
}));
vi.mock("@/lib/security", () => ({ verifyCronRequest: fakes.verifyCronRequest }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: fakes.createAdminClient }));
// The real runDueTasks, wrapped in a spy so the route test can read its call order.
vi.mock("@/lib/ai/tasks/run-due-tasks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/tasks/run-due-tasks")>();
  return { ...actual, runDueTasks: vi.fn(actual.runDueTasks) };
});

import { runDueTasks } from "@/lib/ai/tasks/run-due-tasks";
import type { CopilotTaskRow } from "@/lib/ai/tasks/run-task";
import { TASK_CAPS } from "@/lib/ai/tasks/schedule";
import { GET } from "@/app/api/cron/daily-reset/route";

// ─── A thenable supabase-js stand-in: records every call, resolves per table ──

type Call = { table: string; method: string; args: unknown[] };
type Result = { data: unknown; error: { message: string } | null };

function fakeAdmin(resultFor: (table: string) => Result) {
  const calls: Call[] = [];
  const rpc = vi.fn(async () => ({ data: 0, error: null }));
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "update", "eq", "neq", "lte", "lt", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(resultFor(table)).then(resolve, reject);
    return builder;
  };
  return { admin: { from, rpc } as unknown as SupabaseClient, calls, rpc };
}

const NOW = new Date("2026-10-01T23:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

let seq = 0;
function task(orgId: string, patch: Partial<CopilotTaskRow> = {}): CopilotTaskRow {
  seq++;
  return {
    id: `task-${seq}`,
    organization_id: orgId,
    user_id: `user-${orgId}`,
    title: `Task ${seq}`,
    prompt: "Summarise the pipeline",
    schedule: "daily",
    cron_expression: null,
    is_active: true,
    last_run_at: null,
    next_run_at: iso(NOW.getTime() - HOUR),
    run_count: 0,
    last_result: null,
    locked_at: null,
    last_error: null,
    last_artifact_id: null,
    created_at: iso(NOW.getTime() - 30 * 24 * HOUR),
    updated_at: iso(NOW.getTime() - 30 * 24 * HOUR),
    ...patch,
  };
}

const tasksAdmin = (rows: CopilotTaskRow[]) =>
  fakeAdmin((table) => (table === "copilot_tasks" ? { data: rows, error: null } : { data: null, error: null }));

/** Each run takes 30 s of (fake) wall-clock time. */
function runsTake30s() {
  fakes.runCopilotTask.mockImplementation(async () => {
    vi.setSystemTime(Date.now() + TASK_CAPS.perTaskTimeoutMs);
    return { status: "done", approvals: 0 };
  });
}

const ranIds = () => fakes.runCopilotTask.mock.calls.map(([args]) => (args as { task: CopilotTaskRow }).task.id);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runDueTasks", () => {
  it("with 30 s runs and a 60 s deadline, attempts 2 tasks and defers the rest", async () => {
    runsTake30s();
    const rows = [task("org-1"), task("org-2"), task("org-3"), task("org-4"), task("org-5")];
    const { admin } = tasksAdmin(rows);

    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 60_000 });

    expect(fakes.runCopilotTask).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ attempted: 2, done: 2, skipped: 0, failed: 0, deferred: 3 });
    // Every run is handed the invocation's deadline and the admin client.
    for (const [args] of fakes.runCopilotTask.mock.calls) {
      expect(args).toMatchObject({ deadlineAt: NOW.getTime() + 60_000, admin });
    }
  });

  it("serves a task last run yesterday before one run today", async () => {
    runsTake30s();
    const ranToday = task("org-today", { last_run_at: "2026-10-01T00:30:00.000Z" }); // 22.5 h ago: still due
    const ranYesterday = task("org-yesterday", { last_run_at: "2026-09-30T00:00:00.000Z" });
    const { admin } = tasksAdmin([ranToday, ranYesterday]);

    // Room for exactly one run: the fairer task gets it, the other is deferred.
    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 45_000 });

    expect(ranIds()).toEqual([ranYesterday.id]);
    expect(result).toMatchObject({ attempted: 1, deferred: 1 });

    // With room for both, the order is still yesterday's first.
    vi.clearAllMocks();
    runsTake30s();
    await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 });
    expect(ranIds()).toEqual([ranYesterday.id, ranToday.id]);
  });

  it("runs at most TASK_CAPS.perOrgRunsPerInvocation task per org, the least recently run one", async () => {
    runsTake30s();
    expect(TASK_CAPS.perOrgRunsPerInvocation).toBe(1);
    const a1 = task("org-a", { last_run_at: "2026-09-30T02:00:00.000Z" });
    const a2 = task("org-a", { last_run_at: "2026-09-29T00:00:00.000Z" }); // oldest in org-a
    const a3 = task("org-a", { last_run_at: null, next_run_at: null, is_active: true }); // not due
    const a4 = task("org-a", { last_run_at: "2026-09-30T01:00:00.000Z" });
    const b1 = task("org-b", { last_run_at: "2026-09-30T00:00:00.000Z" });
    const { admin } = tasksAdmin([a1, a2, a3, a4, b1]);

    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 });

    expect(ranIds()).toEqual([a2.id, b1.id]);
    // a1 and a4 are over org-a's cap: not run, still due next time. a3 is not due at all.
    expect(result).toEqual({ attempted: 2, done: 2, skipped: 0, failed: 0, deferred: 2 });
  });

  it("selects active tasks whose next run has passed and drops ones isDue rejects", async () => {
    runsTake30s();
    const due = task("org-1");
    const ranRecently = task("org-2", { last_run_at: iso(NOW.getTime() - 2 * HOUR) });
    const lockedNow = task("org-3", { locked_at: iso(NOW.getTime() - 60_000) });
    const notYet = task("org-4", { next_run_at: iso(NOW.getTime() + HOUR) });
    const { admin, calls } = tasksAdmin([due, ranRecently, lockedNow, notYet]);

    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 });

    expect(ranIds()).toEqual([due.id]);
    expect(result).toEqual({ attempted: 1, done: 1, skipped: 0, failed: 0, deferred: 0 });
    expect(calls).toContainEqual({ table: "copilot_tasks", method: "eq", args: ["is_active", true] });
    expect(calls).toContainEqual({ table: "copilot_tasks", method: "lte", args: ["next_run_at", NOW.toISOString()] });
  });

  it("counts statuses, and a thrown run as failed without stopping the loop", async () => {
    const rows = [task("org-1"), task("org-2"), task("org-3"), task("org-4")];
    fakes.runCopilotTask
      .mockResolvedValueOnce({ status: "done", approvals: 1 })
      .mockRejectedValueOnce(new Error("claiming task failed: boom"))
      .mockResolvedValueOnce({ status: "skipped", approvals: 0, reason: "locked" })
      .mockResolvedValueOnce({ status: "failed", approvals: 0, reason: "provider_no_tools" });
    const { admin } = tasksAdmin(rows);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 });

    expect(result).toEqual({ attempted: 4, done: 1, skipped: 1, failed: 2, deferred: 0 });
  });

  it("starts nothing when a full task timeout no longer fits before the deadline", async () => {
    runsTake30s();
    const { admin } = tasksAdmin([task("org-1"), task("org-2")]);

    const result = await runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + TASK_CAPS.perTaskTimeoutMs - 1 });

    expect(fakes.runCopilotTask).not.toHaveBeenCalled();
    expect(result).toEqual({ attempted: 0, done: 0, skipped: 0, failed: 0, deferred: 2 });
  });

  it("throws when the due-task query fails", async () => {
    const { admin } = fakeAdmin(() => ({ data: null, error: { message: "db down" } }));
    await expect(runDueTasks({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 })).rejects.toThrow(
      "selecting due tasks failed: db down",
    );
  });
});

describe("GET /api/cron/daily-reset", () => {
  it("resets, purges the budget, expires approvals, runs due tasks, then purges guests", async () => {
    runsTake30s();
    const { admin, rpc } = tasksAdmin([task("org-1")]);
    fakes.createAdminClient.mockReturnValue(admin);
    fakes.verifyCronRequest.mockReturnValue(null);
    fakes.expireApprovals.mockResolvedValue(4);
    fakes.purgeExpiredGuests.mockResolvedValue({ scanned: 0, deletedUsers: 0, deletedOrgs: 0, skipped: 0, errors: [] });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await GET(new Request("http://localhost/api/cron/daily-reset"));
    const body = await res.json();

    const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0];
    const spy = vi.mocked(runDueTasks);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(order(fakes.resetDailyCounters)).toBeLessThan(order(rpc));
    expect(order(rpc)).toBeLessThan(order(fakes.expireApprovals));
    expect(order(fakes.expireApprovals)).toBeLessThan(order(spy));
    expect(order(spy)).toBeLessThan(order(fakes.runCopilotTask));
    expect(order(fakes.runCopilotTask)).toBeLessThan(order(fakes.purgeExpiredGuests));

    expect(rpc).toHaveBeenCalledWith("purge_shared_ai_budget", { p_keep_days: 8 });
    expect(fakes.expireApprovals).toHaveBeenCalledWith(admin, 72);
    expect(spy).toHaveBeenCalledWith({ admin, now: NOW, deadlineAt: NOW.getTime() + 200_000 });

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      approvalsExpired: 4,
      tasks: { attempted: 1, done: 1, skipped: 0, failed: 0, deferred: 0 },
      results: { tasks: "ok", approvals_expire: "ok", guest_cleanup: "ok" },
    });
  });

  it("still purges guests and reports the error when running tasks throws", async () => {
    const { admin } = fakeAdmin((table) =>
      table === "copilot_tasks" ? { data: null, error: { message: "db down" } } : { data: null, error: null },
    );
    fakes.createAdminClient.mockReturnValue(admin);
    fakes.verifyCronRequest.mockReturnValue(null);
    fakes.expireApprovals.mockResolvedValue(0);
    fakes.purgeExpiredGuests.mockResolvedValue({ scanned: 0, deletedUsers: 0, deletedOrgs: 0, skipped: 0, errors: [] });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await GET(new Request("http://localhost/api/cron/daily-reset"));
    const body = await res.json();

    expect(fakes.purgeExpiredGuests).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(207);
    expect(body.tasks).toBeNull();
    expect(body.results.tasks).toBe("selecting due tasks failed: db down");
  });

  it("returns the cron auth error without touching anything", async () => {
    fakes.verifyCronRequest.mockReturnValue(new Response("Unauthorized", { status: 401 }));

    const res = await GET(new Request("http://localhost/api/cron/daily-reset"));

    expect(res.status).toBe(401);
    expect(fakes.createAdminClient).not.toHaveBeenCalled();
    expect(runDueTasks).not.toHaveBeenCalled();
  });
});
