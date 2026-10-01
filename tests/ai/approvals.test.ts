import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import { createTestDb, type TestDb } from "../helpers/pglite";
import {
  attachApprovalIds,
  claimApproval,
  expireApprovals,
  extractApprovalRequests,
  listPendingApprovals,
  markApprovalOutcome,
  recordPendingApproval,
} from "@/lib/ai/approvals";
import type { FieldDiff } from "@/lib/ai/tools/diff";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const CONV_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CONV_A2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const DIFF: FieldDiff = {
  kind: "update",
  recordType: "lead",
  recordId: "lead-1",
  baselineUpdatedAt: "2026-10-01T10:00:00.000Z",
  fields: [{ name: "status", before: "warm", after: "hot" }],
};

// ─── A supabase-js query builder over PGlite, covering what approvals.ts uses ──

type Row = Record<string, unknown>;
type PgResult = { data: unknown; error: { message: string; code?: string } | null };

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
};
const columns = (cols: string) =>
  cols.trim() === "*" ? "*" : cols.split(",").map((c) => ident(c.trim())).join(", ");

class PgQuery implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "upsert" | "update" = "select";
  private cols = "*";
  private returning: string | null = null;
  private payload: Row = {};
  private onConflict: string | null = null;
  private ignoreDuplicates = false;
  private where: string[] = [];
  private params: unknown[] = [];
  private orderBy: string[] = [];
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: TestDb, private table: string) {}

  select(cols = "*") {
    if (this.op === "select") this.cols = cols;
    else this.returning = cols;
    return this;
  }
  insert(values: Row) { this.op = "insert"; this.payload = values; return this; }
  upsert(values: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.payload = values;
    this.onConflict = opts.onConflict ?? null;
    this.ignoreDuplicates = opts.ignoreDuplicates ?? false;
    return this;
  }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  private param(v: unknown) { this.params.push(v); return `$${this.params.length}`; }
  eq(col: string, v: unknown) { this.where.push(`${ident(col)} = ${this.param(v)}`); return this; }
  lt(col: string, v: unknown) { this.where.push(`${ident(col)} < ${this.param(v)}`); return this; }
  is(col: string, v: null) {
    if (v !== null) throw new Error("pg fake: is() supports null only");
    this.where.push(`${ident(col)} IS NULL`);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push(`${ident(col)} ${opts?.ascending === false ? "DESC" : "ASC"}`);
    return this;
  }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private sql(): string {
    const where = this.where.length ? ` WHERE ${this.where.join(" AND ")}` : "";
    const ret = this.returning === null ? "" : ` RETURNING ${columns(this.returning)}`;
    if (this.op === "select") {
      const order = this.orderBy.length ? ` ORDER BY ${this.orderBy.join(", ")}` : "";
      return `SELECT ${columns(this.cols)} FROM ${ident(this.table)}${where}${order}`;
    }
    const keys = Object.keys(this.payload);
    if (this.op === "update") {
      const sets = keys.map((k) => `${ident(k)} = ${this.param(this.payload[k])}`).join(", ");
      return `UPDATE ${ident(this.table)} SET ${sets}${where}${ret}`;
    }
    const values = keys.map((k) => this.param(this.payload[k])).join(", ");
    let sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES (${values})`;
    if (this.op === "upsert") {
      if (!this.ignoreDuplicates || !this.onConflict) throw new Error("pg fake: only ignoreDuplicates upserts");
      sql += ` ON CONFLICT (${this.onConflict.split(",").map((c) => ident(c.trim())).join(", ")}) DO NOTHING`;
    }
    return sql + ret;
  }

  private async run(): Promise<PgResult> {
    try {
      const rows = await this.db.query<Row>(this.sql(), this.params);
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

// ─── PGlite with migration 042 ──────────────────────────────────────────────

describe("approval store against PGlite + 042", () => {
  let db: TestDb;
  let admin: Admin;

  beforeAll(async () => {
    db = await createTestDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@example.test');
      INSERT INTO organizations (id, name, slug) VALUES
        ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
      INSERT INTO profiles (id, organization_id, email) VALUES ('${USER_A}', '${ORG_A}', 'a@example.test');
      INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES
        ('${CONV_A}', '${ORG_A}', '${USER_A}'), ('${CONV_A2}', '${ORG_A}', '${USER_A}');
    `);
    await db.applyMigration("042_copilot_v2_history_approvals.sql");
    admin = pgAdmin(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec("DELETE FROM copilot_approvals");
  });

  const record = (toolCallId: string, over: Partial<Parameters<typeof recordPendingApproval>[1]> = {}) =>
    recordPendingApproval(admin, {
      orgId: ORG_A,
      userId: USER_A,
      conversationId: CONV_A,
      taskId: null,
      source: "chat",
      toolCallId,
      toolName: "update_lead",
      input: { id: "lead-1", status: "hot" },
      diff: DIFF,
      ...over,
    });

  const rowsFor = (toolCallId: string) =>
    db.query<Row>("SELECT * FROM copilot_approvals WHERE tool_call_id = $1", [toolCallId]);

  it("recordPendingApproval stores a pending row with the diff, including baselineUpdatedAt", async () => {
    const { id } = await record("call-1");
    const rows = await rowsFor("call-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      organization_id: ORG_A,
      conversation_id: CONV_A,
      status: "pending",
      source: "chat",
      tool_name: "update_lead",
      approval_id: null,
      input: { id: "lead-1", status: "hot" },
    });
    expect((rows[0].diff as FieldDiff).baselineUpdatedAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("recordPendingApproval twice with the same toolCallId returns the same id and leaves one row", async () => {
    const first = await record("call-dup");
    const second = await record("call-dup", { toolName: "something_else" });
    expect(second.id).toBe(first.id);
    const rows = await rowsFor("call-dup");
    expect(rows).toHaveLength(1);
    expect(rows[0].tool_name).toBe("update_lead");
  });

  it("the same toolCallId in another org is a separate row", async () => {
    const a = await record("call-shared");
    const b = await record("call-shared", { orgId: ORG_B, conversationId: null, userId: null, source: "task" });
    expect(b.id).not.toBe(a.id);
    expect(await rowsFor("call-shared")).toHaveLength(2);
  });

  it("attachApprovalIds sets approval_id but does not overwrite an existing one", async () => {
    await record("call-1");
    await record("call-2");
    await attachApprovalIds(admin, {
      orgId: ORG_A,
      conversationId: CONV_A,
      pairs: [{ toolCallId: "call-1", approvalId: "appr-1" }],
    });
    await attachApprovalIds(admin, {
      orgId: ORG_A,
      conversationId: CONV_A,
      pairs: [
        { toolCallId: "call-1", approvalId: "appr-OVERWRITE" },
        { toolCallId: "call-2", approvalId: "appr-2" },
      ],
    });
    expect((await rowsFor("call-1"))[0].approval_id).toBe("appr-1");
    expect((await rowsFor("call-2"))[0].approval_id).toBe("appr-2");
  });

  it("attachApprovalIds does not touch rows of another org or conversation", async () => {
    await record("call-1");
    await attachApprovalIds(admin, { orgId: ORG_B, conversationId: CONV_A, pairs: [{ toolCallId: "call-1", approvalId: "x" }] });
    await attachApprovalIds(admin, { orgId: ORG_A, conversationId: CONV_A2, pairs: [{ toolCallId: "call-1", approvalId: "y" }] });
    expect((await rowsFor("call-1"))[0].approval_id).toBeNull();
  });

  describe("claimApproval", () => {
    beforeEach(async () => {
      await record("call-1");
      await attachApprovalIds(admin, { orgId: ORG_A, conversationId: CONV_A, pairs: [{ toolCallId: "call-1", approvalId: "appr-1" }] });
    });

    it("claim twice -> claimed then not_pending", async () => {
      const first = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-1", approved: true });
      expect(first.status).toBe("claimed");
      if (first.status !== "claimed") throw new Error("unreachable");
      expect(first.row).toMatchObject({ status: "approved", tool_call_id: "call-1", tool_name: "update_lead" });
      expect(first.row.resolved_at).not.toBeNull();

      const second = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-1", approved: true });
      expect(second).toEqual({ status: "not_pending" });
      expect((await rowsFor("call-1"))[0].status).toBe("approved");
    });

    it("a denial claims the row as denied", async () => {
      const res = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-1", approved: false });
      expect(res.status).toBe("claimed");
      expect((await rowsFor("call-1"))[0].status).toBe("denied");
    });

    it("claim with another orgId -> not_found and the row stays pending", async () => {
      const res = await claimApproval(admin, { orgId: ORG_B, conversationId: CONV_A, approvalId: "appr-1", approved: true });
      expect(res).toEqual({ status: "not_found" });
      expect((await rowsFor("call-1"))[0].status).toBe("pending");
    });

    it("claim with wrong conversationId -> not_found and the row stays pending", async () => {
      const other = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A2, approvalId: "appr-1", approved: true });
      expect(other).toEqual({ status: "not_found" });
      const nullConv = await claimApproval(admin, { orgId: ORG_A, conversationId: null, approvalId: "appr-1", approved: true });
      expect(nullConv).toEqual({ status: "not_found" });
      expect((await rowsFor("call-1"))[0].status).toBe("pending");
    });

    it("an unknown approval id -> not_found", async () => {
      const res = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "nope", approved: true });
      expect(res).toEqual({ status: "not_found" });
    });

    it("a NULL conversation matches a NULL conversationId (IS NOT DISTINCT FROM)", async () => {
      await record("task-call", { conversationId: null, source: "task" });
      await db.query("UPDATE copilot_approvals SET approval_id = 'appr-task' WHERE tool_call_id = 'task-call'");
      const wrong = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-task", approved: true });
      expect(wrong).toEqual({ status: "not_found" });
      const res = await claimApproval(admin, { orgId: ORG_A, conversationId: null, approvalId: "appr-task", approved: true });
      expect(res.status).toBe("claimed");
    });
  });

  it("markApprovalOutcome sets applied/failed/stale with the result, scoped to the org", async () => {
    const { id } = await record("call-1");
    await attachApprovalIds(admin, { orgId: ORG_A, conversationId: CONV_A, pairs: [{ toolCallId: "call-1", approvalId: "appr-1" }] });
    await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-1", approved: true });

    await markApprovalOutcome(admin, ORG_B, id, "applied", { ok: true });
    expect((await rowsFor("call-1"))[0].status).toBe("approved");

    await markApprovalOutcome(admin, ORG_A, id, "stale", { error: "record_changed" });
    const row = (await rowsFor("call-1"))[0];
    expect(row.status).toBe("stale");
    expect(row.result).toEqual({ error: "record_changed" });

    // A stale row is never claimable again: a retry must be a fresh proposal.
    const again = await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "appr-1", approved: true });
    expect(again).toEqual({ status: "not_pending" });
  });

  it("listPendingApprovals returns only this org's pending rows, filtered by source", async () => {
    await record("chat-1");
    await record("task-1", { conversationId: null, source: "task" });
    await record("done-1");
    await db.query("UPDATE copilot_approvals SET status = 'applied' WHERE tool_call_id = 'done-1'");
    await record("other-org", { orgId: ORG_B, conversationId: null, userId: null });

    const all = await listPendingApprovals(admin, ORG_A);
    expect(all.map((r) => r.tool_call_id).sort()).toEqual(["chat-1", "task-1"]);
    const tasks = await listPendingApprovals(admin, ORG_A, { source: "task" });
    expect(tasks.map((r) => r.tool_call_id)).toEqual(["task-1"]);
  });

  it("expireApprovals expires only pending rows older than the cutoff and returns the count", async () => {
    await record("old-pending");
    await record("old-approved");
    await record("fresh-pending");
    await record("old-other-org", { orgId: ORG_B, conversationId: null });
    await db.query(
      "UPDATE copilot_approvals SET created_at = now() - interval '73 hours' WHERE tool_call_id IN ('old-pending', 'old-approved', 'old-other-org')",
    );
    await db.query("UPDATE copilot_approvals SET status = 'approved' WHERE tool_call_id = 'old-approved'");

    expect(await expireApprovals(admin)).toBe(2);
    expect((await rowsFor("old-pending"))[0].status).toBe("expired");
    expect((await rowsFor("old-other-org"))[0].status).toBe("expired");
    expect((await rowsFor("old-approved"))[0].status).toBe("approved");
    expect((await rowsFor("fresh-pending"))[0].status).toBe("pending");
    expect(await expireApprovals(admin, 100)).toBe(0);
  });
});

// ─── Every chain on copilot_approvals is org-scoped ──────────────────────────

type Call = { method: string; args: unknown[] };

/** Records each from() chain's calls. Mutations return no rows, selects return one row. */
function recordingAdmin() {
  const chains: Array<{ table: string; calls: Call[] }> = [];
  const admin = {
    from(table: string) {
      const chain = { table, calls: [] as Call[] };
      chains.push(chain);
      const isMutation = () => ["insert", "upsert", "update", "delete"].includes(chain.calls[0]?.method ?? "");
      const result = () => {
        const single = chain.calls.some((c) => c.method === "single" || c.method === "maybeSingle");
        const row = { id: "row-1", status: "approved" };
        if (isMutation()) return { data: single ? null : [], error: null };
        return { data: single ? row : [row], error: null };
      };
      const builder: Record<string, unknown> = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(result()).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            chain.calls.push({ method: prop, args });
            return builder;
          };
        },
      });
      return builder;
    },
  } as unknown as Admin;
  return { admin, chains };
}

describe("org predicates (fake client)", () => {
  it("every copilot_approvals chain in the module calls .eq('organization_id', orgId)", async () => {
    const { admin, chains } = recordingAdmin();
    const base = {
      orgId: ORG_A,
      userId: USER_A,
      conversationId: CONV_A,
      taskId: null,
      source: "chat" as const,
      toolCallId: "call-1",
      toolName: "update_lead",
      input: {},
      diff: DIFF,
    };

    await recordPendingApproval(admin, base);
    await attachApprovalIds(admin, { orgId: ORG_A, conversationId: CONV_A, pairs: [{ toolCallId: "c", approvalId: "a" }] });
    await claimApproval(admin, { orgId: ORG_A, conversationId: CONV_A, approvalId: "a", approved: true });
    await claimApproval(admin, { orgId: ORG_A, conversationId: null, approvalId: "a", approved: false });
    await markApprovalOutcome(admin, ORG_A, "row-1", "failed", { error: "x" });
    await listPendingApprovals(admin, ORG_A);
    await listPendingApprovals(admin, ORG_A, { source: "task" });

    // recordPending: upsert + existing-id select; attach: 1 update; claim x2: update + select each;
    // markOutcome: 1 update; list x2: 1 select each.
    expect(chains).toHaveLength(10);
    for (const chain of chains) {
      expect(chain.table).toBe("copilot_approvals");
      const first = chain.calls[0].method;
      if (first === "insert" || first === "upsert") {
        // An INSERT has no WHERE: the org is the inserted row's own organization_id.
        expect((chain.calls[0].args[0] as Row).organization_id).toBe(ORG_A);
        continue;
      }
      const orgEq = chain.calls.filter((c) => c.method === "eq" && c.args[0] === "organization_id");
      expect(orgEq, `${first} chain: ${JSON.stringify(chain.calls.map((c) => c.method))}`).toHaveLength(1);
      expect(orgEq[0].args[1]).toBe(ORG_A);
    }
  });

  it("expireApprovals is the one cross-org sweep: it only touches pending rows past the cutoff", async () => {
    const { admin, chains } = recordingAdmin();
    await expireApprovals(admin, 72);
    expect(chains).toHaveLength(1);
    const methods = chains[0].calls.map((c) => c.method);
    expect(methods[0]).toBe("update");
    expect(chains[0].calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
    expect(methods).toContain("lt");
  });
});

// ─── extractApprovalRequests ────────────────────────────────────────────────

describe("extractApprovalRequests", () => {
  it("returns only tool parts in state approval-requested, static and dynamic", () => {
    const message = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "text", text: "I will update the lead." },
        {
          type: "tool-update_lead",
          toolCallId: "call-1",
          state: "approval-requested",
          input: { id: "lead-1" },
          approval: { id: "appr-1" },
        },
        {
          type: "dynamic-tool",
          toolName: "create_deal",
          toolCallId: "call-2",
          state: "approval-requested",
          input: {},
          approval: { id: "appr-2" },
        },
        { type: "tool-update_lead", toolCallId: "call-3", state: "input-available", input: {} },
        {
          type: "tool-update_lead",
          toolCallId: "call-4",
          state: "approval-responded",
          input: {},
          approval: { id: "appr-4", approved: true },
        },
        {
          type: "tool-update_lead",
          toolCallId: "call-5",
          state: "output-available",
          input: {},
          output: { ok: true },
          approval: { id: "appr-5", approved: true },
        },
        {
          type: "tool-update_lead",
          toolCallId: "call-6",
          state: "output-denied",
          input: {},
          approval: { id: "appr-6", approved: false },
        },
      ],
    } as unknown as UIMessage;

    expect(extractApprovalRequests(message)).toEqual([
      { toolCallId: "call-1", approvalId: "appr-1", toolName: "update_lead" },
      { toolCallId: "call-2", approvalId: "appr-2", toolName: "create_deal" },
    ]);
  });

  it("returns an empty list for a message with no pending approvals", () => {
    const message = { id: "m2", role: "user", parts: [{ type: "text", text: "hi" }] } as UIMessage;
    expect(extractApprovalRequests(message)).toEqual([]);
  });
});
