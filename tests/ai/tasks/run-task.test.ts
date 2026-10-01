import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestDb, type TestDb } from "../../helpers/pglite";

// ─── Mocks: the model call, the session-dependent budget helpers, automation ──

const fakes = vi.hoisted(() => ({
  generateText: vi.fn(),
  isGuest: vi.fn(),
  budgetStart: vi.fn(),
  budgetSettle: vi.fn(),
  budgetStopWhen: vi.fn(),
  sharedTurnBudget: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: fakes.generateText,
}));
vi.mock("@/lib/ai/shared-budget", () => ({
  sharedCallerIsGuest: fakes.isGuest,
  sharedTurnBudget: fakes.sharedTurnBudget,
}));
vi.mock("@/lib/automation/runner", () => ({ evaluateLeadAgainstRules: vi.fn() }));

import { runCopilotTask, type CopilotTaskRow } from "@/lib/ai/tasks/run-task";
import { TASK_CAPS } from "@/lib/ai/tasks/schedule";

type Admin = SupabaseClient;
type Row = Record<string, unknown>;
type PgResult = { data: unknown; error: { message: string; code?: string } | null };

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // own Anthropic key, not a guest
const ORG_G = "99999999-9999-4999-8999-999999999999"; // guest workspace on the shared env key
const ORG_N = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // OpenAI: no tool support
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_G = "22222222-2222-4222-8222-222222222222";
const USER_N = "33333333-3333-4333-8333-333333333333";
const USER_GONE = "44444444-4444-4444-8444-444444444444"; // auth user without a profile
const LEAD = "55555555-5555-4555-8555-555555555555";

const HOUR = 60 * 60 * 1000;

// ─── A supabase-js query builder over PGlite, covering what run-task.ts and its tools use ──

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
};
const columns = (cols: string) =>
  cols.trim() === "*" ? "*" : cols.split(",").map((c) => ident(c.trim())).join(", ");

/** Splits a PostgREST logic list at top-level commas. */
function splitTopLevel(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (expr[i] === "," && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

const COMPARE: Record<string, string> = { eq: "=", lt: "<", lte: "<=", gt: ">", gte: ">=" };

class PgQuery implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "upsert" | "update" = "select";
  private cols = "*";
  private returning: string | null = null;
  private payload: Row[] = [];
  private onConflict: string | null = null;
  private where: string[] = [];
  private params: unknown[] = [];
  private orderBy: string[] = [];
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: TestDb, private table: string) {}

  select(cols = "*") {
    if (this.op === "select") this.cols = cols;
    else this.returning = cols;
    return this;
  }
  insert(values: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    if (!opts.ignoreDuplicates || !opts.onConflict) throw new Error("pg fake: only ignoreDuplicates upserts");
    this.op = "upsert";
    this.payload = [values];
    this.onConflict = opts.onConflict;
    return this;
  }
  update(values: Row) { this.op = "update"; this.payload = [values]; return this; }
  private param(v: unknown) {
    this.params.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
    return `$${this.params.length}`;
  }
  private cmp(col: string, op: string, v: unknown) { this.where.push(`${ident(col)} ${COMPARE[op]} ${this.param(v)}`); return this; }
  eq(col: string, v: unknown) { return this.cmp(col, "eq", v); }
  lt(col: string, v: unknown) { return this.cmp(col, "lt", v); }
  lte(col: string, v: unknown) { return this.cmp(col, "lte", v); }
  is(col: string, v: null) {
    if (v !== null) throw new Error("pg fake: is() supports null only");
    this.where.push(`${ident(col)} IS NULL`);
    return this;
  }
  /** PostgREST logic trees: and(...), or(...), col.is.null, col.<eq|lt|lte|gt|gte>.value */
  or(expr: string) {
    const node = (item: string): string => {
      const group = /^(and|or)\(([\s\S]*)\)$/.exec(item);
      if (group) {
        const joiner = group[1] === "and" ? " AND " : " OR ";
        return `(${splitTopLevel(group[2]).map(node).join(joiner)})`;
      }
      const [col, op, ...rest] = item.split(".");
      const value = rest.join(".");
      if (op === "is" && value === "null") return `${ident(col)} IS NULL`;
      if (!COMPARE[op]) throw new Error(`pg fake: or op ${op} unsupported`);
      return `${ident(col)} ${COMPARE[op]} ${this.param(value)}`;
    };
    this.where.push(`(${splitTopLevel(expr).map(node).join(" OR ")})`);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push(`${ident(col)} ${opts?.ascending === false ? "DESC" : "ASC"}`);
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private sql(): string {
    const where = this.where.length ? ` WHERE ${this.where.join(" AND ")}` : "";
    const ret = this.returning === null ? "" : ` RETURNING ${columns(this.returning)}`;
    if (this.op === "select") {
      const order = this.orderBy.length ? ` ORDER BY ${this.orderBy.join(", ")}` : "";
      const limit = this.limitN === null ? "" : ` LIMIT ${this.limitN}`;
      return `SELECT ${columns(this.cols)} FROM ${ident(this.table)}${where}${order}${limit}`;
    }
    if (this.op === "update") {
      const patch = this.payload[0];
      const sets = Object.keys(patch).map((k) => `${ident(k)} = ${this.param(patch[k])}`).join(", ");
      return `UPDATE ${ident(this.table)} SET ${sets}${where}${ret}`;
    }
    const keys = Object.keys(this.payload[0]);
    const tuples = this.payload.map((row) => `(${keys.map((k) => this.param(row[k] ?? null)).join(", ")})`);
    let sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;
    if (this.op === "upsert") {
      sql += ` ON CONFLICT (${this.onConflict!.split(",").map((c) => ident(c.trim())).join(", ")}) DO NOTHING`;
    }
    return sql + ret;
  }

  private async run(): Promise<PgResult> {
    try {
      // PostgREST returns timestamps as ISO strings.
      const rows = (await this.db.query<Row>(this.sql(), this.params)).map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])),
      );
      const data = this.op !== "select" && this.returning === null ? null : rows;
      if (this.mode === "many") return { data, error: null };
      const list = (data ?? []) as Row[];
      if (list.length > 1 || (this.mode === "single" && list.length === 0)) {
        return { data: null, error: { message: `expected one row, got ${list.length}` } };
      }
      return { data: list[0] ?? null, error: null };
    } catch (err) {
      const e = err as { message: string; code?: string };
      return { data: null, error: { message: e.message, code: e.code } };
    }
  }

  then<T1, T2>(
    onfulfilled?: ((v: PgResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

const pgAdmin = (db: TestDb) => ({ from: (table: string) => new PgQuery(db, table) }) as unknown as Admin;

// ─── Fixture ─────────────────────────────────────────────────────────────────

type GenerateArgs = {
  system: string;
  prompt: string;
  tools: Record<string, { execute: (input: unknown, opts: { toolCallId: string; messages: unknown[] }) => Promise<unknown> }>;
  abortSignal: AbortSignal;
  maxOutputTokens: number;
};

const STEP = { usage: { inputTokens: 100, outputTokens: 50 }, response: { messages: [] } };

describe("runCopilotTask against PGlite + 042/043", () => {
  let db: TestDb;
  let admin: Admin;
  const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    db = await createTestDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'a@example.test'), ('${USER_G}', 'g@example.test'),
        ('${USER_N}', 'n@example.test'), ('${USER_GONE}', 'gone@example.test');
      INSERT INTO organizations (id, name, slug) VALUES
        ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_G}', 'Guest', 'org-g'), ('${ORG_N}', 'Org N', 'org-n');
      INSERT INTO profiles (id, organization_id, email) VALUES
        ('${USER_A}', '${ORG_A}', 'a@example.test'),
        ('${USER_G}', '${ORG_G}', 'g@example.test'),
        ('${USER_N}', '${ORG_N}', 'n@example.test');
      INSERT INTO ai_settings (organization_id, ai_provider, api_key) VALUES ('${ORG_A}', 'anthropic', 'test-org-key');
      INSERT INTO ai_settings (organization_id, ai_provider, openai_api_key) VALUES ('${ORG_N}', 'openai', 'test-openai-key');
      INSERT INTO leads (id, organization_id, name, email, status) VALUES
        ('${LEAD}', '${ORG_A}', 'Ada Lead', 'ada@example.test', 'cold');
      INSERT INTO copilot_memory (organization_id, user_id, type, title, content) VALUES
        ('${ORG_A}', '${USER_A}', 'business_details', 'Biz', 'We sell solar panels to farms.');
    `);
    await db.applyMigration("042_copilot_v2_history_approvals.sql");
    await db.applyMigration("043_copilot_v2_artifacts_memory_notifications.sql");
    admin = pgAdmin(db);
    // ORG_G has no ai_settings row: it runs on the shared env key, so the budget applies.
    process.env.ANTHROPIC_API_KEY = "test-env-key";
  });

  afterAll(async () => {
    if (savedAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(`
      DELETE FROM notifications; DELETE FROM copilot_approvals; DELETE FROM copilot_artifacts; DELETE FROM copilot_tasks;
      UPDATE leads SET status = 'cold' WHERE id = '${LEAD}';
    `);
    vi.clearAllMocks();
    fakes.isGuest.mockImplementation(async (orgId: string) => orgId === ORG_G);
    fakes.budgetStart.mockResolvedValue({ ok: true, day: "2026-10-01", reserved: 2000 });
    fakes.budgetSettle.mockResolvedValue(undefined);
    fakes.budgetStopWhen.mockResolvedValue(false);
    fakes.sharedTurnBudget.mockImplementation(() => ({
      start: fakes.budgetStart,
      stopWhen: fakes.budgetStopWhen,
      settle: fakes.budgetSettle,
    }));
    fakes.generateText.mockResolvedValue({ text: "All quiet today.", steps: [STEP] });
  });

  async function insertTask(org: string, user: string, over: Partial<Row> = {}): Promise<CopilotTaskRow> {
    const values: Row = {
      organization_id: org,
      user_id: user,
      title: "Weekly pipeline review",
      prompt: "Review hot leads and propose status changes.",
      schedule: "weekly",
      is_active: true,
      next_run_at: new Date(Date.now() - HOUR).toISOString(),
      ...over,
    };
    const { data, error } = await admin.from("copilot_tasks").insert(values).select("*").single();
    if (error) throw new Error(error.message);
    return data as CopilotTaskRow;
  }

  const taskRow = async (id: string) =>
    (await db.query<Row>("SELECT * FROM copilot_tasks WHERE id = $1", [id]))[0];
  const deadline = () => Date.now() + 60_000;

  it("a record write becomes a pending 'task' approval, the record is unchanged, and the report and both notifications exist", async () => {
    const task = await insertTask(ORG_A, USER_A);
    let seen: GenerateArgs | null = null;
    fakes.generateText.mockImplementation(async (args: GenerateArgs) => {
      seen = args;
      const out = await args.tools.update_lead.execute({ id: LEAD, status: "hot" }, { toolCallId: "call-write-1", messages: [] });
      expect(out).toMatchObject({ status: "proposed", queued: true });
      return { text: "Proposed moving Ada Lead to hot.", steps: [STEP, STEP] };
    });

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "done", approvals: 1 });
    expect(result.artifactId).toEqual(expect.any(String));

    // The tool set handed to generateText: task mode, no create_task.
    const args = seen as unknown as GenerateArgs;
    expect(Object.keys(args.tools)).not.toContain("create_task");
    expect(Object.keys(args.tools)).toEqual(expect.arrayContaining(["update_lead", "save_artifact", "search_leads"]));
    expect(args.prompt).toBe(task.prompt);
    expect(args.maxOutputTokens).toBe(TASK_CAPS.maxOutputTokens);
    expect(args.abortSignal).toBeInstanceOf(AbortSignal);
    expect(args.system).toContain("<workspace_memory>");
    expect(args.system).toContain("We sell solar panels to farms.");

    const approvals = await db.query<Row>("SELECT * FROM copilot_approvals");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      organization_id: ORG_A,
      user_id: USER_A,
      task_id: task.id,
      conversation_id: null,
      source: "task",
      status: "pending",
      tool_call_id: "call-write-1",
      tool_name: "update_lead",
    });
    expect((approvals[0].diff as { fields: Array<{ name: string; before: unknown; after: unknown }> }).fields).toEqual([
      { name: "status", before: "cold", after: "hot" },
    ]);

    const [lead] = await db.query<Row>("SELECT status FROM leads WHERE id = $1", [LEAD]);
    expect(lead.status).toBe("cold");

    const artifacts = await db.query<Row>("SELECT * FROM copilot_artifacts");
    expect(artifacts).toHaveLength(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(artifacts[0]).toMatchObject({
      id: result.artifactId,
      organization_id: ORG_A,
      task_id: task.id,
      kind: "report",
      title: `Weekly pipeline review — ${today}`,
    });
    expect((artifacts[0].content as { text: string }).text).toBe("Proposed moving Ada Lead to hot.");

    const notes = await db.query<Row>("SELECT * FROM notifications ORDER BY kind DESC");
    expect(notes.map((n) => n.kind)).toEqual(["task_result", "approval_pending"]);
    for (const n of notes) expect(n).toMatchObject({ organization_id: ORG_A, user_id: USER_A });
    expect(notes[0].link).toContain(String(result.artifactId));

    const row = await taskRow(task.id);
    expect(row.locked_at).toBeNull();
    expect(row.run_count).toBe(1);
    expect(row.last_artifact_id).toBe(result.artifactId);
    expect(row.last_result).toBe("Proposed moving Ada Lead to hot.");
    expect(row.last_error).toBeNull();
    expect(row.last_run_at).not.toBeNull();
    expect((row.next_run_at as Date).getTime()).toBeGreaterThan(Date.now());
    // An org-owned key is not charged to the shared budget.
    expect(fakes.sharedTurnBudget).not.toHaveBeenCalled();
  });

  it("a thrown error fails the run, records last_error and releases the lock", async () => {
    const task = await insertTask(ORG_A, USER_A);
    fakes.generateText.mockRejectedValue(new Error("provider exploded"));

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "failed", reason: "provider exploded" });
    const row = await taskRow(task.id);
    expect(row.locked_at).toBeNull();
    expect(row.last_error).toBe("provider exploded");
    expect(row.run_count).toBe(1);
    expect(await db.query("SELECT id FROM copilot_artifacts")).toHaveLength(0);
    expect(await db.query("SELECT id FROM notifications")).toHaveLength(0);
  });

  it("a second concurrent run of the same occurrence is skipped", async () => {
    const task = await insertTask(ORG_A, USER_A);
    const [first, second] = await Promise.all([
      runCopilotTask({ task, deadlineAt: deadline(), admin }),
      runCopilotTask({ task, deadlineAt: deadline(), admin }),
    ]);

    expect([first.status, second.status].sort()).toEqual(["done", "skipped"]);
    expect([first, second].find((r) => r.status === "skipped")?.reason).toBe("locked");
    expect(fakes.generateText).toHaveBeenCalledTimes(1);
    expect(await db.query("SELECT id FROM copilot_artifacts")).toHaveLength(1);

    // The same occurrence cannot run again afterwards either (last_run_at within 20 h).
    const again = await runCopilotTask({ task, deadlineAt: deadline(), admin });
    expect(again).toMatchObject({ status: "skipped", reason: "locked" });
    expect((await taskRow(task.id)).run_count).toBe(1);
  });

  it("a guest workspace runs when its task is within guestPerOrg, on the shared budget", async () => {
    expect(TASK_CAPS.guestPerOrg).toBe(1);
    const task = await insertTask(ORG_G, USER_G);

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "done", approvals: 0 });
    expect(fakes.isGuest).toHaveBeenCalledWith(ORG_G);
    expect(fakes.sharedTurnBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_G,
        isGuest: true,
        maxOutputTokens: TASK_CAPS.maxOutputTokens,
        maxSteps: TASK_CAPS.stepsPerRun,
      }),
    );
    expect(fakes.budgetStart).toHaveBeenCalledTimes(1);
    expect(fakes.budgetSettle).toHaveBeenCalledWith([STEP]);
    const notes = await db.query<Row>("SELECT kind, user_id FROM notifications");
    expect(notes).toEqual([{ kind: "task_result", user_id: USER_G }]);
  });

  it("a guest task beyond guestPerOrg is skipped with task_cap", async () => {
    await insertTask(ORG_G, USER_G, { created_at: new Date(Date.now() - 2 * HOUR).toISOString() });
    const extra = await insertTask(ORG_G, USER_G);

    const result = await runCopilotTask({ task: extra, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "skipped", reason: "task_cap" });
    expect(fakes.generateText).not.toHaveBeenCalled();
    const row = await taskRow(extra.id);
    expect(row.locked_at).toBeNull();
    expect(row.last_error).toBe("task_cap");
  });

  it("a task whose owner profile is missing is skipped as owner_gone and deactivated", async () => {
    // USER_GONE exists in auth.users but has no profile in ORG_A (removed from the workspace).
    const task = await insertTask(ORG_A, USER_GONE);

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "skipped", reason: "owner_gone" });
    expect(fakes.generateText).not.toHaveBeenCalled();
    const row = await taskRow(task.id);
    expect(row.is_active).toBe(false);
    expect(row.locked_at).toBeNull();
    expect(row.last_error).toBe("owner_gone");
  });

  it("fails with provider_no_tools when the workspace's provider cannot run tools", async () => {
    const task = await insertTask(ORG_N, USER_N);

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "failed", reason: "provider_no_tools" });
    expect(fakes.generateText).not.toHaveBeenCalled();
    const row = await taskRow(task.id);
    expect(row.locked_at).toBeNull();
    expect(row.last_error).toBe("provider_no_tools");
  });

  it("skips an invalid custom schedule with invalid_schedule and releases the lock", async () => {
    const task = await insertTask(ORG_A, USER_A, { schedule: "custom", cron_expression: "not a cron" });

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "skipped", reason: "invalid_schedule" });
    expect(fakes.generateText).not.toHaveBeenCalled();
    const row = await taskRow(task.id);
    expect(row.locked_at).toBeNull();
    expect(row.last_error).toBe("invalid_schedule");
    expect(row.next_run_at).toBeNull();
  });

  it("does not claim a task that is not due yet", async () => {
    const task = await insertTask(ORG_A, USER_A, { next_run_at: new Date(Date.now() + HOUR).toISOString() });

    const result = await runCopilotTask({ task, deadlineAt: deadline(), admin });

    expect(result).toMatchObject({ status: "skipped", reason: "locked" });
    expect((await taskRow(task.id)).locked_at).toBeNull();
  });
});
