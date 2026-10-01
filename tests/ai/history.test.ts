import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import { createTestDb, type TestDb } from "../helpers/pglite";
import {
  TURN_LOCK_TTL_SECONDS,
  acquireTurnLock,
  applyApprovalResponses,
  getOrCreateConversation,
  loadUiMessages,
  persistUiMessages,
  persistUserMessage,
  releaseTurnLock,
} from "@/lib/ai/history";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const CONV_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LEGACY_ROW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

// ─── A supabase-js query builder over PGlite, covering what history.ts uses ──
// Adapted from tests/ai/approvals.test.ts; adds or(), order(nullsFirst) and
// plain inserts. It emits the SQL PostgREST would, so a unique violation
// surfaces as error code 23505 just like the real client.

type Row = Record<string, unknown>;
type PgResult = { data: unknown; error: { message: string; code?: string } | null };

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
};
const columns = (cols: string) =>
  cols.trim() === "*" ? "*" : cols.split(",").map((c) => ident(c.trim())).join(", ");

class PgQuery implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "update" = "select";
  private cols = "*";
  private returning: string | null = null;
  private payload: Row = {};
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
  /** PostgREST logic tree, limited to `col.is.null` and `col.lt.value` terms. */
  or(filter: string) {
    const terms = filter.split(",").map((term) => {
      const [, col, op, raw] = /^([a-z_]+)\.(is|lt)\.(.+)$/.exec(term) ?? [];
      if (!col) throw new Error(`pg fake: unsupported or() term ${term}`);
      if (op === "is") {
        if (raw !== "null") throw new Error("pg fake: is supports null only");
        return `${ident(col)} IS NULL`;
      }
      return `${ident(col)} < ${this.param(raw.replace(/^"(.*)"$/, "$1"))}`;
    });
    this.where.push(`(${terms.join(" OR ")})`);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? "DESC" : "ASC";
    const nulls = opts?.nullsFirst === undefined ? "" : opts.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
    this.orderBy.push(`${ident(col)} ${dir}${nulls}`);
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
    return `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES (${values})${ret}`;
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

// ─── Fixtures ───────────────────────────────────────────────────────────────

const userMsg = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });
const assistantMsg = (id: string, parts: UIMessage["parts"]): UIMessage => ({ id, role: "assistant", parts });

const approvalPart = (toolCallId: string, approvalId: string) =>
  ({
    type: "tool-update_lead",
    toolCallId,
    state: "approval-requested",
    input: { id: "lead-1", status: "hot" },
    approval: { id: approvalId },
  }) as unknown as UIMessage["parts"][number];

// ─── PGlite with migration 042 ──────────────────────────────────────────────

describe("conversation history against PGlite + 042", () => {
  let db: TestDb;
  let admin: Admin;

  beforeAll(async () => {
    db = await createTestDb();
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'a@example.test'), ('${USER_B}', 'b@example.test');
      INSERT INTO organizations (id, name, slug) VALUES
        ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
      INSERT INTO profiles (id, organization_id, email) VALUES
        ('${USER_A}', '${ORG_A}', 'a@example.test'), ('${USER_B}', '${ORG_A}', 'b@example.test');
    `);
    await db.applyMigration("042_copilot_v2_history_approvals.sql");
    admin = pgAdmin(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec("DELETE FROM copilot_messages; DELETE FROM copilot_conversations;");
    await db.exec(
      `INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES ('${CONV_A}', '${ORG_A}', '${USER_A}')`,
    );
  });

  const messageRows = () =>
    db.query<Row>(
      "SELECT id, message_id, role, content, parts, seq FROM copilot_messages WHERE conversation_id = $1 ORDER BY seq NULLS FIRST, created_at",
      [CONV_A],
    );

  describe("getOrCreateConversation", () => {
    it("returns a supplied id that belongs to the org and the user", async () => {
      expect(await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A, conversationId: CONV_A })).toEqual({
        id: CONV_A,
      });
    });

    it("wrong user_id -> not_found", async () => {
      expect(await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_B, conversationId: CONV_A })).toEqual({
        error: "not_found",
      });
    });

    it("wrong org -> not_found", async () => {
      expect(await getOrCreateConversation(admin, { orgId: ORG_B, userId: USER_A, conversationId: CONV_A })).toEqual({
        error: "not_found",
      });
    });

    it("an unknown id -> not_found and nothing is created", async () => {
      const res = await getOrCreateConversation(admin, {
        orgId: ORG_A,
        userId: USER_A,
        conversationId: "99999999-9999-4999-8999-999999999999",
        pageKey: "leads",
      });
      expect(res).toEqual({ error: "not_found" });
      expect(await db.query("SELECT id FROM copilot_conversations")).toHaveLength(1);
    });

    it("pageKey returns the same conversation per (org, user, page), even under concurrent calls", async () => {
      const [a, b] = await Promise.all([
        getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A, pageKey: "leads", title: "Leads" }),
        getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A, pageKey: "leads" }),
      ]);
      expect("id" in a && "id" in b && a.id === b.id).toBe(true);
      const again = await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A, pageKey: "leads" });
      expect(again).toEqual(a);

      const rows = await db.query<Row>("SELECT user_id, page_key, title FROM copilot_conversations WHERE page_key = 'leads'");
      expect(rows).toEqual([{ user_id: USER_A, page_key: "leads", title: "Leads" }]);

      // Another user on the same page gets their own conversation.
      const other = await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_B, pageKey: "leads" });
      expect("id" in other && "id" in a && other.id !== a.id).toBe(true);
    });

    it("with neither id nor pageKey creates a new conversation each time", async () => {
      const a = await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A });
      const b = await getOrCreateConversation(admin, { orgId: ORG_A, userId: USER_A });
      expect("id" in a && "id" in b && a.id !== b.id).toBe(true);
    });

    it("PostgREST-style ON CONFLICT without the index predicate cannot target the partial index (why upsert is not used)", async () => {
      await expect(
        db.query(
          `INSERT INTO copilot_conversations (organization_id, user_id, page_key) VALUES ($1, $2, 'x')
           ON CONFLICT (organization_id, user_id, page_key) DO NOTHING`,
          [ORG_A, USER_A],
        ),
      ).rejects.toThrow(/no unique or exclusion constraint/);
    });
  });

  describe("messages", () => {
    it("a legacy row (parts NULL) round-trips as a text part with its row id", async () => {
      await db.query(
        "INSERT INTO copilot_messages (id, conversation_id, organization_id, role, content) VALUES ($1, $2, $3, 'assistant', 'Old answer')",
        [LEGACY_ROW, CONV_A, ORG_A],
      );
      const loaded = await loadUiMessages(admin, CONV_A, ORG_A);
      expect(loaded).toEqual([{ id: LEGACY_ROW, role: "assistant", parts: [{ type: "text", text: "Old answer" }] }]);

      // Persisting the loaded history back upgrades that row in place instead of duplicating it.
      await persistUiMessages(admin, { conversationId: CONV_A, orgId: ORG_A, userId: USER_A, messages: loaded });
      const rows = await messageRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: LEGACY_ROW, message_id: LEGACY_ROW, seq: 0, content: "Old answer" });
      expect(await loadUiMessages(admin, CONV_A, ORG_A)).toEqual(loaded);
    });

    it("legacy rows sort before new rows; new rows follow seq", async () => {
      await db.query(
        "INSERT INTO copilot_messages (id, conversation_id, organization_id, role, content) VALUES ($1, $2, $3, 'user', 'legacy question')",
        [LEGACY_ROW, CONV_A, ORG_A],
      );
      await persistUserMessage(admin, {
        conversationId: CONV_A, orgId: ORG_A, userId: USER_A, message: userMsg("u2", "second"), seq: 2,
      });
      await persistUserMessage(admin, {
        conversationId: CONV_A, orgId: ORG_A, userId: USER_A, message: userMsg("u1", "first"), seq: 1,
      });
      expect((await loadUiMessages(admin, CONV_A, ORG_A)).map((m) => m.id)).toEqual([LEGACY_ROW, "u1", "u2"]);
    });

    it("persistUserMessage then persistUiMessages with the same message id leaves one row", async () => {
      const user = userMsg("m-user", "Update lead 1 to hot");
      await persistUserMessage(admin, { conversationId: CONV_A, orgId: ORG_A, userId: USER_A, message: user, seq: 0 });
      expect(await messageRows()).toHaveLength(1);

      const reply = assistantMsg("m-asst", [{ type: "text", text: "Done. " }, { type: "text", text: "Lead is hot." }]);
      await persistUiMessages(admin, { conversationId: CONV_A, orgId: ORG_A, userId: USER_A, messages: [user, reply] });

      const rows = await messageRows();
      expect(rows.map((r) => r.message_id)).toEqual(["m-user", "m-asst"]);
      expect(rows[1]).toMatchObject({ role: "assistant", content: "Done. Lead is hot.", seq: 1 });
      expect(rows[1].parts).toEqual(reply.parts);
    });

    it("persist twice is idempotent, and a changed message is updated in place", async () => {
      const messages = [userMsg("a", "hi"), assistantMsg("b", [{ type: "text", text: "hello" }])];
      const args = { conversationId: CONV_A, orgId: ORG_A, userId: USER_A, messages };
      await persistUiMessages(admin, args);
      const first = await messageRows();
      await persistUiMessages(admin, args);
      expect(await messageRows()).toEqual(first);

      const edited = [messages[0], assistantMsg("b", [{ type: "text", text: "hello again" }])];
      await persistUiMessages(admin, { ...args, messages: edited });
      const rows = await messageRows();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({ id: first[1].id, content: "hello again" });
      expect(await loadUiMessages(admin, CONV_A, ORG_A)).toEqual(edited);
    });

    it("never deletes rows missing from the persisted list", async () => {
      const args = { conversationId: CONV_A, orgId: ORG_A, userId: USER_A };
      await persistUiMessages(admin, { ...args, messages: [userMsg("a", "one"), userMsg("b", "two")] });
      await persistUiMessages(admin, { ...args, messages: [userMsg("b", "two")] });
      expect((await messageRows()).map((r) => r.message_id).sort()).toEqual(["a", "b"]);
    });

    it("writes are refused for another user's or another org's conversation", async () => {
      const message = userMsg("x", "hi");
      await expect(
        persistUserMessage(admin, { conversationId: CONV_A, orgId: ORG_A, userId: USER_B, message, seq: 0 }),
      ).rejects.toThrow(/conversation not found/);
      await expect(
        persistUiMessages(admin, { conversationId: CONV_A, orgId: ORG_B, userId: USER_A, messages: [message] }),
      ).rejects.toThrow(/conversation not found/);
      expect(await messageRows()).toHaveLength(0);
    });

    it("persistUserMessage refuses a non-user message", async () => {
      await expect(
        persistUserMessage(admin, {
          conversationId: CONV_A, orgId: ORG_A, userId: USER_A, message: assistantMsg("x", []), seq: 0,
        }),
      ).rejects.toThrow(/user message/);
    });

    it("loadUiMessages is scoped to the org", async () => {
      await persistUiMessages(admin, { conversationId: CONV_A, orgId: ORG_A, userId: USER_A, messages: [userMsg("a", "hi")] });
      expect(await loadUiMessages(admin, CONV_A, ORG_B)).toEqual([]);
    });
  });

  describe("turn lock", () => {
    const lockRow = async () =>
      (await db.query<{ turn_lock_until: Date | null; turn_lock_token: string | null }>(
        "SELECT turn_lock_until, turn_lock_token FROM copilot_conversations WHERE id = $1",
        [CONV_A],
      ))[0];

    it("acquireTurnLock second call returns false (null) until released", async () => {
      const token = await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A });
      expect(token).toMatch(/^[0-9a-f-]{36}$/);
      expect(await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A })).toBeNull();

      await releaseTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A, token: token! });
      expect(await lockRow()).toEqual({ turn_lock_until: null, turn_lock_token: null });
      expect(await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A })).not.toBeNull();
    });

    it("default TTL >= 130 s", async () => {
      expect(TURN_LOCK_TTL_SECONDS).toBeGreaterThanOrEqual(130);
      const before = Date.now();
      await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A });
      const until = new Date((await lockRow()).turn_lock_until!).getTime();
      expect(until - before).toBeGreaterThanOrEqual(130_000);
    });

    it("an expired lock can be taken over, and the stale holder's release does not clear it", async () => {
      const old = await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A });
      await db.query("UPDATE copilot_conversations SET turn_lock_until = now() - interval '1 second' WHERE id = $1", [CONV_A]);
      const fresh = await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A });
      expect(fresh).not.toBeNull();
      expect(fresh).not.toBe(old);

      await releaseTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A, token: old! });
      expect((await lockRow()).turn_lock_token).toBe(fresh);
    });

    it("another org cannot take or release the lock", async () => {
      expect(await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_B })).toBeNull();
      const token = await acquireTurnLock(admin, { conversationId: CONV_A, orgId: ORG_A });
      await releaseTurnLock(admin, { conversationId: CONV_A, orgId: ORG_B, token: token! });
      expect((await lockRow()).turn_lock_token).toBe(token);
    });
  });
});

// ─── applyApprovalResponses (pure) ──────────────────────────────────────────

describe("applyApprovalResponses", () => {
  const earlier = assistantMsg("asst-1", [approvalPart("call-old", "appr-old")]);
  const last = assistantMsg("asst-2", [
    { type: "text", text: "I will update two leads." },
    approvalPart("call-1", "appr-1"),
    approvalPart("call-2", "appr-2"),
  ]);
  const history = [userMsg("u1", "first"), earlier, userMsg("u2", "second"), last];

  it("moves matching parts of the last assistant message to approval-responded", () => {
    const { messages, unmatched } = applyApprovalResponses(history, [
      { approvalId: "appr-1", approved: true },
      { approvalId: "appr-2", approved: false, reason: "wrong lead" },
    ]);
    expect(unmatched).toEqual([]);
    const parts = messages[3].parts as unknown as Array<Record<string, unknown>>;
    expect(parts[0]).toEqual({ type: "text", text: "I will update two leads." });
    expect(parts[1]).toMatchObject({
      toolCallId: "call-1",
      state: "approval-responded",
      approval: { id: "appr-1", approved: true },
    });
    expect(parts[2]).toMatchObject({
      toolCallId: "call-2",
      state: "approval-responded",
      approval: { id: "appr-2", approved: false, reason: "wrong lead" },
    });
  });

  it("reports unmatched ids and never touches earlier assistant messages", () => {
    const { messages, unmatched } = applyApprovalResponses(history, [
      { approvalId: "appr-old", approved: true },
      { approvalId: "nope", approved: true },
      { approvalId: "appr-1", approved: true },
    ]);
    expect(unmatched).toEqual(["appr-old", "nope"]);
    expect(messages[1]).toBe(earlier);
    expect((earlier.parts[0] as unknown as { state: string }).state).toBe("approval-requested");
    expect((messages[3].parts[1] as unknown as { state: string }).state).toBe("approval-responded");
    expect((messages[3].parts[2] as unknown as { state: string }).state).toBe("approval-requested");
  });

  it("is pure: the input messages are not mutated", () => {
    const snapshot = JSON.parse(JSON.stringify(history));
    applyApprovalResponses(history, [{ approvalId: "appr-1", approved: true }]);
    expect(history).toEqual(snapshot);
  });

  it("a second response for an already-answered id is unmatched", () => {
    const { unmatched } = applyApprovalResponses(history, [
      { approvalId: "appr-1", approved: true },
      { approvalId: "appr-1", approved: false },
    ]);
    expect(unmatched).toEqual(["appr-1"]);
  });

  it("with no assistant message every id is unmatched and messages are returned as is", () => {
    const only = [userMsg("u1", "hi")];
    const res = applyApprovalResponses(only, [{ approvalId: "appr-1", approved: true }]);
    expect(res).toEqual({ messages: only, unmatched: ["appr-1"] });
  });
});
