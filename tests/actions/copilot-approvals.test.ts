import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";
import type { FieldDiff } from "@/lib/ai/tools/diff";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const CONV_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TASK_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const LEAD_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const LEAD_UPDATED_AT = "2026-09-30T10:00:00.000Z";

// ─── A supabase-js query builder over PGlite ───────────────────────────────
// Adapted from tests/ai/history.test.ts; adds count/head selects, limit() and
// `col.eq.value` terms in or(). The connection is a superuser, so tenant
// isolation here comes only from the predicates the code under test sends.

type Row = Record<string, unknown>;
type PgResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
};
const columns = (cols: string) =>
  cols.trim() === "*" ? "*" : cols.split(",").map((c) => ident(c.trim())).join(", ");

class PgQuery implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "update" = "select";
  private cols = "*";
  private countOnly = false;
  private returning: string | null = null;
  private payload: Row = {};
  private where: string[] = [];
  private params: unknown[] = [];
  private orderBy: string[] = [];
  private max: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: TestDb, private table: string) {}

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op === "select") {
      this.cols = cols;
      this.countOnly = opts?.head === true && opts.count === "exact";
    } else {
      this.returning = cols;
    }
    return this;
  }
  insert(values: Row) { this.op = "insert"; this.payload = values; return this; }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  private param(v: unknown) {
    this.params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
    return `$${this.params.length}`;
  }
  eq(col: string, v: unknown) { this.where.push(`${ident(col)} = ${this.param(v)}`); return this; }
  is(col: string, v: null) {
    if (v !== null) throw new Error("pg fake: is() supports null only");
    this.where.push(`${ident(col)} IS NULL`);
    return this;
  }
  /** PostgREST logic tree, limited to `col.is.null` and `col.eq.value` terms. */
  or(filter: string) {
    const terms = filter.split(",").map((term) => {
      const [, col, op, raw] = /^([a-z_]+)\.(is|eq)\.(.+)$/.exec(term) ?? [];
      if (!col) throw new Error(`pg fake: unsupported or() term ${term}`);
      if (op === "is") {
        if (raw !== "null") throw new Error("pg fake: is supports null only");
        return `${ident(col)} IS NULL`;
      }
      return `${ident(col)}::text = ${this.param(raw)}`;
    });
    this.where.push(`(${terms.join(" OR ")})`);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push(`${ident(col)} ${opts?.ascending === false ? "DESC" : "ASC"}`);
    return this;
  }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private sql(): string {
    const where = this.where.length ? ` WHERE ${this.where.join(" AND ")}` : "";
    const ret = this.returning === null ? "" : ` RETURNING ${columns(this.returning)}`;
    if (this.op === "select") {
      if (this.countOnly) return `SELECT count(*)::int AS count FROM ${ident(this.table)}${where}`;
      const order = this.orderBy.length ? ` ORDER BY ${this.orderBy.join(", ")}` : "";
      const limit = this.max === null ? "" : ` LIMIT ${Math.trunc(this.max)}`;
      return `SELECT ${columns(this.cols)} FROM ${ident(this.table)}${where}${order}${limit}`;
    }
    const keys = Object.keys(this.payload);
    if (this.op === "update") {
      const sets = keys.map((k) => `${ident(k)} = ${this.param(this.payload[k])}`).join(", ");
      return `UPDATE ${ident(this.table)} SET ${sets}${where}${ret}`;
    }
    const values = keys.map((k) => this.param(this.payload[k])).join(", ");
    return `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES (${values})${ret}`;
  }

  private async run(): Promise<PgResult> {
    try {
      const rows = await this.db.query<Row>(this.sql(), this.params);
      if (this.countOnly) return { data: null, error: null, count: rows[0].count as number };
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

// ─── Module mocks: session + clients point at PGlite, registry spy ─────────

const state: { db: TestDb | null } = { db: null };
const pgClient = (kind: "rls" | "admin") => ({
  kind,
  from: (table: string) => new PgQuery(state.db as TestDb, table),
  auth: { getUser: async () => ({ data: { user: { id: USER_A } } }) },
});
const rlsClient = pgClient("rls");
const adminClient = pgClient("admin");

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => rlsClient,
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => ORG_A }));
vi.mock("@/lib/ai/tools/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/tools/registry")>();
  return { ...actual, executeRegistryTool: vi.fn() };
});

import { executeRegistryTool } from "@/lib/ai/tools/registry";
import { listPendingApprovalsAction, resolveApproval, undoCopilotWrite } from "@/lib/actions/copilot-approvals";

const executeSpy = vi.mocked(executeRegistryTool);

// ─── Fixtures ───────────────────────────────────────────────────────────────

const diffFor = (before: string, after: string): FieldDiff => ({
  kind: "update",
  recordType: "lead",
  recordId: LEAD_A,
  baselineUpdatedAt: LEAD_UPDATED_AT,
  fields: [{ name: "status", before, after }],
});

let seq = 0;
async function seedApproval(over: {
  orgId?: string;
  source?: "chat" | "task";
  conversationId?: string | null;
  status?: string;
  diff?: FieldDiff;
  input?: Row;
} = {}): Promise<string> {
  const db = state.db as TestDb;
  const source = over.source ?? "task";
  const rows = await db.query<{ id: string }>(
    `INSERT INTO copilot_approvals
       (organization_id, user_id, conversation_id, task_id, tool_call_id, tool_name, input, diff, source, status)
     VALUES ($1, $2, $3, $4, $5, 'update_lead', $6, $7, $8, $9) RETURNING id`,
    [
      over.orgId ?? ORG_A,
      USER_A,
      over.conversationId === undefined ? (source === "chat" ? CONV_A : null) : over.conversationId,
      source === "task" ? TASK_A : null,
      `call-${++seq}`,
      JSON.stringify(over.input ?? { id: LEAD_A, status: "hot" }),
      JSON.stringify(over.diff ?? diffFor("warm", "hot")),
      source,
      over.status ?? "pending",
    ],
  );
  return rows[0].id;
}

const approvalRow = async (id: string) =>
  (await (state.db as TestDb).query<Row>("SELECT * FROM copilot_approvals WHERE id = $1", [id]))[0];

describe("copilot approvals actions against PGlite + 042/043", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    state.db = db;
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@example.test');
      INSERT INTO organizations (id, name, slug) VALUES
        ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
      INSERT INTO profiles (id, organization_id, email) VALUES ('${USER_A}', '${ORG_A}', 'a@example.test');
      INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES ('${CONV_A}', '${ORG_A}', '${USER_A}');
    `);
    await db.applyMigration("042_copilot_v2_history_approvals.sql");
    await db.applyMigration("043_copilot_v2_artifacts_memory_notifications.sql");
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    executeSpy.mockReset();
    await db.exec(`
      DELETE FROM copilot_approvals;
      DELETE FROM notifications;
      DELETE FROM leads;
      DELETE FROM copilot_artifacts;
      DELETE FROM copilot_memory;
    `);
    await db.query(
      `INSERT INTO leads (id, organization_id, name, email, status, updated_at)
       VALUES ($1, $2, 'Ada', 'ada@example.test', 'warm', $3)`,
      [LEAD_A, ORG_A, LEAD_UPDATED_AT],
    );
  });

  describe("resolveApproval", () => {
    it("returns invalid for a chat-sourced row and leaves it pending", async () => {
      const id = await seedApproval({ source: "chat" });

      expect(await resolveApproval(id, true)).toEqual({ status: "invalid" });
      expect(await resolveApproval(id, false)).toEqual({ status: "invalid" });

      const row = await approvalRow(id);
      expect(row.status).toBe("pending");
      expect(row.resolved_at).toBeNull();
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("applies a task-sourced row once; the second resolve is invalid", async () => {
      const id = await seedApproval();
      executeSpy.mockResolvedValue({ ok: true, data: { updated: { id: LEAD_A } }, automationsSkipped: [] });

      const first = await resolveApproval(id, true);
      expect(first.status).toBe("applied");
      expect(executeSpy).toHaveBeenCalledTimes(1);
      const [name, input, env, opts] = executeSpy.mock.calls[0];
      expect(name).toBe("update_lead");
      expect(input).toEqual({ id: LEAD_A, status: "hot" });
      expect(env.db).toBe(rlsClient);
      expect(env.ctx).toMatchObject({ source: "chat", userId: USER_A, orgId: ORG_A });
      expect(opts?.diff).toEqual(diffFor("warm", "hot"));

      let row = await approvalRow(id);
      expect(row.status).toBe("applied");
      expect(row.resolved_at).not.toBeNull();
      expect(row.result).toMatchObject({ ok: true });

      const second = await resolveApproval(id, true);
      expect(second).toEqual({ status: "invalid" });
      expect(executeSpy).toHaveBeenCalledTimes(1);
      row = await approvalRow(id);
      expect(row.status).toBe("applied");
    });

    it("returns stale without executing when the live record no longer matches the diff", async () => {
      await db.query("UPDATE leads SET status = 'cold' WHERE id = $1", [LEAD_A]);
      const id = await seedApproval();

      const result = await resolveApproval(id, true);

      expect(result.status).toBe("stale");
      expect(executeSpy).not.toHaveBeenCalled();
      const row = await approvalRow(id);
      expect(row.status).toBe("stale");
      expect(row.result).toMatchObject({ ok: false, error: "record_changed" });
      const [lead] = await db.query<Row>("SELECT status FROM leads WHERE id = $1", [LEAD_A]);
      expect(lead.status).toBe("cold");
    });

    it("returns stale when the target record is gone", async () => {
      await db.exec("DELETE FROM leads");
      const id = await seedApproval();

      expect((await resolveApproval(id, true)).status).toBe("stale");
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("maps an executor record_changed to stale and other errors to failed", async () => {
      const staleId = await seedApproval();
      executeSpy.mockResolvedValueOnce({ ok: false, error: "record_changed" });
      expect((await resolveApproval(staleId, true)).status).toBe("stale");
      expect((await approvalRow(staleId)).status).toBe("stale");

      const failedId = await seedApproval();
      executeSpy.mockResolvedValueOnce({ ok: false, error: "boom" });
      const failed = await resolveApproval(failedId, true);
      expect(failed).toEqual({ status: "failed", result: { ok: false, error: "boom" } });
      expect((await approvalRow(failedId)).status).toBe("failed");
    });

    it("denies without executing", async () => {
      const id = await seedApproval();

      expect(await resolveApproval(id, false)).toEqual({ status: "denied" });

      expect(executeSpy).not.toHaveBeenCalled();
      const row = await approvalRow(id);
      expect(row.status).toBe("denied");
      expect(row.resolved_at).not.toBeNull();
    });

    it("cannot claim another org's row or a malformed id", async () => {
      const id = await seedApproval({ orgId: ORG_B });

      expect(await resolveApproval(id, true)).toEqual({ status: "invalid" });
      expect(await resolveApproval("not-a-uuid", true)).toEqual({ status: "invalid" });

      expect((await approvalRow(id)).status).toBe("pending");
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("fails a row whose tool is not a task-proposable write, without executing", async () => {
      const id = await seedApproval();
      await db.query("UPDATE copilot_approvals SET tool_name = 'delete_record' WHERE id = $1", [id]);

      expect((await resolveApproval(id, true)).status).toBe("failed");
      expect(executeSpy).not.toHaveBeenCalled();
      expect((await approvalRow(id)).status).toBe("failed");
    });

    it("marks the approval_pending notification read once no task approvals remain", async () => {
      executeSpy.mockResolvedValue({ ok: true, data: {}, automationsSkipped: [] });
      const first = await seedApproval();
      const second = await seedApproval();
      await db.query(
        `INSERT INTO notifications (organization_id, user_id, kind, title) VALUES
           ($1, $2, 'approval_pending', 'Task proposed changes'),
           ($1, $2, 'task_result', 'Task finished')`,
        [ORG_A, USER_A],
      );
      const readState = async () =>
        Object.fromEntries(
          (await db.query<{ kind: string; read_at: string | null }>("SELECT kind, read_at FROM notifications")).map(
            (n) => [n.kind, n.read_at !== null],
          ),
        );

      await resolveApproval(first, true);
      expect(await readState()).toEqual({ approval_pending: false, task_result: false });

      await resolveApproval(second, false);
      expect(await readState()).toEqual({ approval_pending: true, task_result: false });
    });
  });

  describe("listPendingApprovalsAction", () => {
    it("returns this org's pending rows, mapped", async () => {
      const taskRow = await seedApproval();
      const chatRow = await seedApproval({ source: "chat" });
      await seedApproval({ status: "applied" });
      await seedApproval({ orgId: ORG_B });

      const list = await listPendingApprovalsAction();

      expect(list.map((r) => r.id).sort()).toEqual([taskRow, chatRow].sort());
      const task = list.find((r) => r.id === taskRow);
      expect(task).toMatchObject({
        approvalId: null,
        toolName: "update_lead",
        source: "task",
        taskId: TASK_A,
        diff: diffFor("warm", "hot"),
      });
      expect(task?.createdAt).toBeTruthy();
    });
  });

  describe("undoCopilotWrite", () => {
    it("rejects an unknown tool and changes nothing", async () => {
      const [art] = await db.query<{ id: string }>(
        `INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, 'note', 'N', '{}') RETURNING id`,
        [ORG_A],
      );
      const undo = undoCopilotWrite as (info: { tool: string; id: string }) => Promise<{ ok: boolean }>;

      expect(await undo({ tool: "update_lead", id: LEAD_A })).toEqual({ ok: false });
      expect(await undo({ tool: "delete_record", id: art.id })).toEqual({ ok: false });

      const [lead] = await db.query<Row>("SELECT status FROM leads WHERE id = $1", [LEAD_A]);
      expect(lead.status).toBe("warm");
      const [artifact] = await db.query<Row>("SELECT deleted_at FROM copilot_artifacts WHERE id = $1", [art.id]);
      expect(artifact.deleted_at).toBeNull();
    });

    it("soft-deletes a saved artifact", async () => {
      const [art] = await db.query<{ id: string }>(
        `INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, 'note', 'N', '{}') RETURNING id`,
        [ORG_A],
      );

      expect(await undoCopilotWrite({ tool: "save_artifact", id: art.id })).toEqual({ ok: true });

      const rows = await db.query<Row>("SELECT deleted_at FROM copilot_artifacts WHERE id = $1", [art.id]);
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted_at).not.toBeNull();
      expect(await undoCopilotWrite({ tool: "save_artifact", id: art.id })).toEqual({ ok: false });
    });

    it("deactivates saved memory in the caller's org only", async () => {
      const [mine] = await db.query<{ id: string }>(
        `INSERT INTO copilot_memory (organization_id, user_id, type, title, content, source)
         VALUES ($1, $2, 'custom', 'M', 'c', 'copilot') RETURNING id`,
        [ORG_A, USER_A],
      );
      const [theirs] = await db.query<{ id: string }>(
        `INSERT INTO copilot_memory (organization_id, user_id, type, title, content, source)
         VALUES ($1, $2, 'custom', 'M', 'c', 'copilot') RETURNING id`,
        [ORG_B, USER_A],
      );

      expect(await undoCopilotWrite({ tool: "save_memory", id: mine.id })).toEqual({ ok: true });
      expect(await undoCopilotWrite({ tool: "save_memory", id: theirs.id })).toEqual({ ok: false });

      const rows = await db.query<{ id: string; is_active: boolean }>("SELECT id, is_active FROM copilot_memory");
      expect(Object.fromEntries(rows.map((r) => [r.id, r.is_active]))).toEqual({ [mine.id]: false, [theirs.id]: true });
    });
  });
});
