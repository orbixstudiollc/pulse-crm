import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";

const MIGRATION = "042_copilot_v2_history_approvals.sql";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const CONV_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CONV_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let db: TestDb;

async function insertApproval(
  org: string,
  toolCallId: string,
  extra: { approvalId?: string | null; status?: string } = {},
): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO copilot_approvals
       (organization_id, conversation_id, tool_call_id, approval_id, tool_name, input, diff, source, status)
     VALUES ($1, $2, $3, $4, 'update_lead', '{}'::jsonb, '{}'::jsonb, 'chat', $5)
     RETURNING id`,
    [org, org === ORG_A ? CONV_A : CONV_B, toolCallId, extra.approvalId ?? null, extra.status ?? "pending"],
  );
  return rows[0].id;
}

/** Runs fn as an authenticated user, so RLS applies (the harness connection is a superuser). */
async function asMember<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.setUser(uid);
  await db.exec("SET ROLE authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.setUser(null);
  }
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${MEMBER_A}', 'a@example.test'), ('${MEMBER_B}', 'b@example.test');
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
    INSERT INTO profiles (id, organization_id, email) VALUES
      ('${MEMBER_A}', '${ORG_A}', 'a@example.test'), ('${MEMBER_B}', '${ORG_B}', 'b@example.test');
    INSERT INTO ai_settings (organization_id) VALUES ('${ORG_A}');
    INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES
      ('${CONV_A}', '${ORG_A}', '${MEMBER_A}'), ('${CONV_B}', '${ORG_B}', '${MEMBER_B}');
    -- A legacy (pre-042) message: no parts / message_id / seq.
    INSERT INTO copilot_messages (conversation_id, organization_id, role, content)
      VALUES ('${CONV_A}', '${ORG_A}', 'user', 'legacy hello');
  `);
  await db.applyMigration(MIGRATION);
});

afterEach(async () => {
  await db.exec("RESET ROLE");
  await db.setUser(null);
});

afterAll(async () => {
  await db.close();
});

describe("migration 042: apply", () => {
  it("applies a second time without error", async () => {
    await expect(db.applyMigration(MIGRATION)).resolves.toBeUndefined();
    const policies = await db.query<{ policyname: string; cmd: string }>(
      "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'copilot_approvals'",
    );
    expect(policies).toEqual([{ policyname: "copilot_approvals_select_org", cmd: "SELECT" }]);
  });

  it("adds copilot_always_allow defaulting to an empty array, also on existing rows", async () => {
    const rows = await db.query<{ copilot_always_allow: unknown }>(
      "SELECT copilot_always_allow FROM ai_settings WHERE organization_id = $1",
      [ORG_A],
    );
    expect(rows).toEqual([{ copilot_always_allow: [] }]);
  });
});

describe("migration 042: copilot_approvals constraints", () => {
  it("claim is atomic: pending -> approved returns 1 row, then 0 rows", async () => {
    const id = await insertApproval(ORG_A, "call-claim");
    const claim = "UPDATE copilot_approvals SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING id";
    expect(await db.query(claim, [id])).toEqual([{ id }]);
    expect(await db.query(claim, [id])).toEqual([]);
  });

  it("rejects an unknown status", async () => {
    await expect(insertApproval(ORG_A, "call-bogus", { status: "bogus" })).rejects.toThrow(/check constraint/i);
  });

  it("rejects an unknown source", async () => {
    await expect(
      db.query(
        `INSERT INTO copilot_approvals (organization_id, tool_call_id, tool_name, input, diff, source)
         VALUES ($1, 'call-src', 'x', '{}', '{}', 'email')`,
        [ORG_A],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it("rejects a duplicate (organization_id, tool_call_id)", async () => {
    await insertApproval(ORG_A, "call-dup");
    await expect(insertApproval(ORG_A, "call-dup")).rejects.toThrow(/duplicate key/i);
    // The same tool_call_id in another org is fine.
    await expect(insertApproval(ORG_B, "call-dup")).resolves.toMatch(/[0-9a-f-]{36}/);
  });

  it("allows several rows with approval_id NULL in one org, but not a duplicate approval_id", async () => {
    await insertApproval(ORG_A, "call-null-1", { approvalId: null });
    await insertApproval(ORG_A, "call-null-2", { approvalId: null });
    const nulls = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM copilot_approvals WHERE organization_id = $1 AND tool_call_id LIKE 'call-null-%' AND approval_id IS NULL",
      [ORG_A],
    );
    expect(nulls[0].n).toBe(2);

    await insertApproval(ORG_A, "call-appr-1", { approvalId: "appr-1" });
    await expect(insertApproval(ORG_A, "call-appr-2", { approvalId: "appr-1" })).rejects.toThrow(/duplicate key/i);
  });
});

describe("migration 042: copilot_approvals org cascade", () => {
  it("deleting the org removes its approval rows, including task rows with no conversation", async () => {
    const ORG_C = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await db.exec(`INSERT INTO organizations (id, name, slug) VALUES ('${ORG_C}', 'Org C', 'org-c')`);
    await db.query(
      `INSERT INTO copilot_approvals (organization_id, tool_call_id, tool_name, input, diff, source)
       VALUES ($1, 'call-task-c', 'update_lead', '{}', '{}', 'task')`,
      [ORG_C],
    );
    const count = async () =>
      (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM copilot_approvals WHERE organization_id = $1", [ORG_C]))[0].n;
    expect(await count()).toBe(1);

    await db.query("DELETE FROM organizations WHERE id = $1", [ORG_C]);
    expect(await count()).toBe(0);
  });

  it("rejects an approval row for an org that does not exist", async () => {
    await expect(
      db.query(
        `INSERT INTO copilot_approvals (organization_id, tool_call_id, tool_name, input, diff, source)
         VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'call-no-org', 'x', '{}', '{}', 'task')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});

describe("migration 042: copilot_approvals RLS (server-write-only)", () => {
  it("a member cannot INSERT but can SELECT only their org's rows", async () => {
    await insertApproval(ORG_A, "call-rls-a");
    await insertApproval(ORG_B, "call-rls-b");

    await expect(
      asMember(MEMBER_A, () => insertApproval(ORG_A, "call-rls-member")),
    ).rejects.toThrow(/row-level security/i);

    const visible = await asMember(MEMBER_A, () =>
      db.query<{ organization_id: string; tool_call_id: string }>(
        "SELECT organization_id, tool_call_id FROM copilot_approvals",
      ),
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((r) => r.organization_id === ORG_A)).toBe(true);
    expect(visible.map((r) => r.tool_call_id)).toContain("call-rls-a");
    expect(visible.map((r) => r.tool_call_id)).not.toContain("call-rls-member");
  });

  it("a member's UPDATE and DELETE affect no rows", async () => {
    const id = await insertApproval(ORG_A, "call-rls-upd");
    const updated = await asMember(MEMBER_A, () =>
      db.query("UPDATE copilot_approvals SET status = 'approved' WHERE id = $1 RETURNING id", [id]),
    );
    const deleted = await asMember(MEMBER_A, () =>
      db.query("DELETE FROM copilot_approvals WHERE id = $1 RETURNING id", [id]),
    );
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    const rows = await db.query<{ status: string }>("SELECT status FROM copilot_approvals WHERE id = $1", [id]);
    expect(rows).toEqual([{ status: "pending" }]);
  });
});

describe("migration 042: copilot_messages legacy path", () => {
  it("legacy rows with NULL parts still select for a member", async () => {
    const rows = await asMember(MEMBER_A, () =>
      db.query<{ content: string; parts: unknown; message_id: unknown; seq: unknown }>(
        "SELECT content, parts, message_id, seq FROM copilot_messages WHERE conversation_id = $1",
        [CONV_A],
      ),
    );
    expect(rows).toContainEqual({ content: "legacy hello", parts: null, message_id: null, seq: null });
  });

  it("the pre-042 org_access policy still allows a member insert", async () => {
    const inserted = await asMember(MEMBER_A, () =>
      db.query<{ id: string }>(
        `INSERT INTO copilot_messages (conversation_id, organization_id, role, content)
         VALUES ($1, $2, 'assistant', 'legacy client write') RETURNING id`,
        [CONV_A, ORG_A],
      ),
    );
    expect(inserted).toHaveLength(1);
    const policies = await db.query<{ policyname: string }>(
      "SELECT policyname FROM pg_policies WHERE tablename = 'copilot_messages'",
    );
    expect(policies).toEqual([{ policyname: "org_access" }]);
  });

  it("message_id is unique per conversation when set", async () => {
    const insert = (convId: string, org: string) =>
      db.query(
        `INSERT INTO copilot_messages (conversation_id, organization_id, role, content, parts, message_id, seq)
         VALUES ($1, $2, 'user', '', '[]'::jsonb, 'msg-1', 1)`,
        [convId, org],
      );
    await insert(CONV_A, ORG_A);
    await expect(insert(CONV_A, ORG_A)).rejects.toThrow(/duplicate key/i);
    await expect(insert(CONV_B, ORG_B)).resolves.toBeDefined();
  });
});

describe("migration 042: copilot_conversations", () => {
  it("page_key is unique per (org, user) when set", async () => {
    const insert = (pageKey: string | null) =>
      db.query(
        "INSERT INTO copilot_conversations (organization_id, user_id, page_key) VALUES ($1, $2, $3)",
        [ORG_A, MEMBER_A, pageKey],
      );
    await insert("leads");
    await expect(insert("leads")).rejects.toThrow(/duplicate key/i);
    await insert(null);
    await expect(insert(null)).resolves.toBeDefined();
  });

  it("turn lock: token-guarded release cannot clear a newer holder's lock", async () => {
    const acquire = (token: string) =>
      db.query(
        `UPDATE copilot_conversations
            SET turn_lock_until = now() + interval '150 seconds', turn_lock_token = $2
          WHERE id = $1 AND (turn_lock_until IS NULL OR turn_lock_until < now())
          RETURNING id`,
        [CONV_A, token],
      );
    const release = (token: string) =>
      db.query(
        `UPDATE copilot_conversations SET turn_lock_until = NULL, turn_lock_token = NULL
          WHERE id = $1 AND turn_lock_token = $2 RETURNING id`,
        [CONV_A, token],
      );
    const tokenOld = "00000000-0000-4000-8000-000000000001";
    const tokenNew = "00000000-0000-4000-8000-000000000002";

    expect(await acquire(tokenOld)).toHaveLength(1);
    expect(await acquire(tokenNew)).toHaveLength(0); // held

    // The old holder's lock expires; a new request takes it over.
    await db.query("UPDATE copilot_conversations SET turn_lock_until = now() - interval '1 second' WHERE id = $1", [CONV_A]);
    expect(await acquire(tokenNew)).toHaveLength(1);

    // The stale request finishes late: its release must not touch the new lock.
    expect(await release(tokenOld)).toHaveLength(0);
    const held = await db.query<{ turn_lock_token: string }>(
      "SELECT turn_lock_token FROM copilot_conversations WHERE id = $1",
      [CONV_A],
    );
    expect(held).toEqual([{ turn_lock_token: tokenNew }]);

    expect(await release(tokenNew)).toHaveLength(1);
  });
});
