import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";

const MIGRATION = "044_copilot_messages_server_write.sql";
const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations",
  MIGRATION,
);

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_A2 = "33333333-3333-4333-8333-333333333333";
const CONV_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CONV_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONV_A_DOOMED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CONV_A2 = "abababab-abab-4bab-8bab-abababababab";
const MSG_A = "f0000000-0000-4000-8000-00000000000a";
const MSG_B = "f0000000-0000-4000-8000-00000000000b";

let db: TestDb;

/** Runs fn as an authenticated org member, so RLS applies (the harness connection is a superuser). */
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

/** Runs fn as the service role (BYPASSRLS, as on Supabase). */
async function asServiceRole<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE service_role");
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function conversationOf(id: string) {
  const rows = await db.query<{ user_id: string; title: string; turn_lock_until: string | null; is_pinned: boolean }>(
    "SELECT user_id, title, turn_lock_until, is_pinned FROM copilot_conversations WHERE id = $1",
    [id],
  );
  return rows[0];
}

async function contentOf(id: string): Promise<string | undefined> {
  const rows = await db.query<{ content: string }>("SELECT content FROM copilot_messages WHERE id = $1", [id]);
  return rows[0]?.content;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${MEMBER_A}', 'a@example.test'), ('${MEMBER_B}', 'b@example.test'), ('${MEMBER_A2}', 'a2@example.test');
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
    INSERT INTO profiles (id, organization_id, email) VALUES
      ('${MEMBER_A}', '${ORG_A}', 'a@example.test'), ('${MEMBER_B}', '${ORG_B}', 'b@example.test'),
      ('${MEMBER_A2}', '${ORG_A}', 'a2@example.test');
    INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES
      ('${CONV_A}', '${ORG_A}', '${MEMBER_A}'),
      ('${CONV_A_DOOMED}', '${ORG_A}', '${MEMBER_A}'),
      ('${CONV_A2}', '${ORG_A}', '${MEMBER_A2}'),
      ('${CONV_B}', '${ORG_B}', '${MEMBER_B}');
    INSERT INTO copilot_messages (id, conversation_id, organization_id, role, content) VALUES
      ('${MSG_A}', '${CONV_A}', '${ORG_A}', 'user', 'hello from A'),
      ('${MSG_B}', '${CONV_B}', '${ORG_B}', 'user', 'hello from B');
    INSERT INTO copilot_messages (conversation_id, organization_id, role, content) VALUES
      ('${CONV_A_DOOMED}', '${ORG_A}', 'user', 'doomed');
  `);
  await db.applyMigration("042_copilot_v2_history_approvals.sql");
  await db.applyMigration(MIGRATION);
});

afterEach(async () => {
  await db.exec("RESET ROLE");
  await db.setUser(null);
});

afterAll(async () => {
  await db.close();
});

describe("migration 044: apply", () => {
  it("before 044 the 021 org_access ALL policy let a member insert (sanity check of the baseline)", async () => {
    const fresh = await createTestDb();
    try {
      await fresh.exec(`
        INSERT INTO auth.users (id) VALUES ('${MEMBER_A}');
        INSERT INTO organizations (id, name, slug) VALUES ('${ORG_A}', 'Org A', 'org-a');
        INSERT INTO profiles (id, organization_id, email) VALUES ('${MEMBER_A}', '${ORG_A}', 'a@example.test');
        INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES ('${CONV_A}', '${ORG_A}', '${MEMBER_A}');
      `);
      await fresh.applyMigration("042_copilot_v2_history_approvals.sql");
      await fresh.setUser(MEMBER_A);
      await fresh.exec("SET ROLE authenticated");
      const inserted = await fresh.query(
        "INSERT INTO copilot_messages (conversation_id, organization_id, role, content) VALUES ($1, $2, 'user', 'x') RETURNING id",
        [CONV_A, ORG_A],
      );
      expect(inserted).toHaveLength(1);
    } finally {
      await fresh.close();
    }
  });

  it("before 044 the 021 org_access ALL policy let a member take over another member's conversation (baseline)", async () => {
    const fresh = await createTestDb();
    try {
      await fresh.exec(`
        INSERT INTO auth.users (id) VALUES ('${MEMBER_A}'), ('${MEMBER_A2}');
        INSERT INTO organizations (id, name, slug) VALUES ('${ORG_A}', 'Org A', 'org-a');
        INSERT INTO profiles (id, organization_id, email) VALUES
          ('${MEMBER_A}', '${ORG_A}', 'a@example.test'), ('${MEMBER_A2}', '${ORG_A}', 'a2@example.test');
        INSERT INTO copilot_conversations (id, organization_id, user_id) VALUES ('${CONV_A2}', '${ORG_A}', '${MEMBER_A2}');
      `);
      await fresh.applyMigration("042_copilot_v2_history_approvals.sql");
      await fresh.setUser(MEMBER_A);
      await fresh.exec("SET ROLE authenticated");
      const taken = await fresh.query(
        "UPDATE copilot_conversations SET user_id = $1, turn_lock_until = now() + interval '100 years' WHERE id = $2 RETURNING id",
        [MEMBER_A, CONV_A2],
      );
      expect(taken).toHaveLength(1);
    } finally {
      await fresh.close();
    }
  });

  it("applies a second time without error and leaves exactly one SELECT policy", async () => {
    await expect(db.applyMigration(MIGRATION)).resolves.toBeUndefined();
    const policies = await db.query<{ policyname: string; cmd: string; roles: string[] }>(
      "SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'copilot_messages'",
    );
    expect(policies).toEqual([{ policyname: "copilot_messages_select_org", cmd: "SELECT", roles: ["authenticated"] }]);
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.copilot_messages'::regclass",
    );
    expect(rls).toEqual([{ relrowsecurity: true }]);

    const conversationPolicies = await db.query<{ policyname: string; cmd: string; roles: string[] }>(
      "SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'copilot_conversations' ORDER BY policyname",
    );
    expect(conversationPolicies).toEqual([
      { policyname: "copilot_conversations_delete_own", cmd: "DELETE", roles: ["authenticated"] },
      { policyname: "copilot_conversations_insert_own", cmd: "INSERT", roles: ["authenticated"] },
      { policyname: "copilot_conversations_select_own", cmd: "SELECT", roles: ["authenticated"] },
      { policyname: "copilot_conversations_update_own", cmd: "UPDATE", roles: ["authenticated"] },
    ]);
    const updatable = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE table_schema = 'public' AND table_name = 'copilot_conversations'
          AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
        ORDER BY column_name`,
    );
    expect(updatable.map((r) => r.column_name)).toEqual(["is_pinned", "summary", "title", "updated_at"]);
  });

  it("is one transaction with a header comment and no DROP TABLE", async () => {
    const sql = await readFile(MIGRATION_PATH, "utf8");
    expect(sql.startsWith("--")).toBe(true);
    expect(sql.match(/^\s*BEGIN\s*;/gim)).toHaveLength(1);
    expect(sql.match(/^\s*COMMIT\s*;/gim)).toHaveLength(1);
    expect(sql).toMatch(/APPLY ONLY AFTER/);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});

describe("migration 044: an authenticated org member", () => {
  it("can SELECT own-org messages, and only those", async () => {
    const rows = await asMember(MEMBER_A, () =>
      db.query<{ id: string; organization_id: string }>(
        "SELECT id, organization_id FROM copilot_messages WHERE conversation_id = $1",
        [CONV_A],
      ),
    );
    expect(rows).toEqual([{ id: MSG_A, organization_id: ORG_A }]);

    const all = await asMember(MEMBER_A, () =>
      db.query<{ organization_id: string }>("SELECT DISTINCT organization_id FROM copilot_messages"),
    );
    expect(all).toEqual([{ organization_id: ORG_A }]);
  });

  it("cannot INSERT a message into their own org (RLS rejects it)", async () => {
    await expect(
      asMember(MEMBER_A, () =>
        db.query(
          "INSERT INTO copilot_messages (conversation_id, organization_id, role, content) VALUES ($1, $2, 'user', 'forged')",
          [CONV_A, ORG_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
    const forged = await db.query("SELECT id FROM copilot_messages WHERE content = 'forged'");
    expect(forged).toEqual([]);
  });

  it("cannot UPDATE an own-org message (no row matches, content unchanged)", async () => {
    const updated = await asMember(MEMBER_A, () =>
      db.query("UPDATE copilot_messages SET content = 'tampered' WHERE id = $1 RETURNING id", [MSG_A]),
    );
    expect(updated).toEqual([]);
    expect(await contentOf(MSG_A)).toBe("hello from A");
  });

  it("cannot DELETE an own-org message (no row matches, row still there)", async () => {
    const deleted = await asMember(MEMBER_A, () =>
      db.query("DELETE FROM copilot_messages WHERE id = $1 RETURNING id", [MSG_A]),
    );
    expect(deleted).toEqual([]);
    expect(await contentOf(MSG_A)).toBe("hello from A");
  });

  it("cannot read, update or delete another org's messages", async () => {
    const read = await asMember(MEMBER_A, () => db.query("SELECT id FROM copilot_messages WHERE id = $1", [MSG_B]));
    expect(read).toEqual([]);
    const updated = await asMember(MEMBER_A, () =>
      db.query("UPDATE copilot_messages SET content = 'x' WHERE id = $1 RETURNING id", [MSG_B]),
    );
    expect(updated).toEqual([]);
    expect(await contentOf(MSG_B)).toBe("hello from B");
  });

  it("still removes a conversation's messages by deleting the conversation (FK cascade)", async () => {
    const deleted = await asMember(MEMBER_A, () =>
      db.query("DELETE FROM copilot_conversations WHERE id = $1 RETURNING id", [CONV_A_DOOMED]),
    );
    expect(deleted).toEqual([{ id: CONV_A_DOOMED }]);
    const left = await db.query("SELECT id FROM copilot_messages WHERE conversation_id = $1", [CONV_A_DOOMED]);
    expect(left).toEqual([]);
  });
});

describe("migration 044: copilot_conversations are per-user", () => {
  it("a member reads only their own conversations, not another member's or another org's", async () => {
    const owners = await asMember(MEMBER_A, () =>
      db.query<{ user_id: string }>("SELECT DISTINCT user_id FROM copilot_conversations"),
    );
    expect(owners).toEqual([{ user_id: MEMBER_A }]);

    const sameOrg = await asMember(MEMBER_A, () =>
      db.query("SELECT id FROM copilot_conversations WHERE id = $1", [CONV_A2]),
    );
    expect(sameOrg).toEqual([]);
    const otherOrg = await asMember(MEMBER_A, () =>
      db.query("SELECT id FROM copilot_conversations WHERE id = $1", [CONV_B]),
    );
    expect(otherOrg).toEqual([]);
  });

  it("a member cannot rewrite user_id or turn_lock_until on another member's conversation", async () => {
    await expect(
      asMember(MEMBER_A, () =>
        db.query("UPDATE copilot_conversations SET user_id = $1 WHERE id = $2 RETURNING id", [MEMBER_A, CONV_A2]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asMember(MEMBER_A, () =>
        db.query(
          "UPDATE copilot_conversations SET turn_lock_until = now() + interval '100 years' WHERE id = $1 RETURNING id",
          [CONV_A2],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
    // Even a member-writable column matches no row on someone else's conversation.
    const renamed = await asMember(MEMBER_A, () =>
      db.query("UPDATE copilot_conversations SET title = 'mine now' WHERE id = $1 RETURNING id", [CONV_A2]),
    );
    expect(renamed).toEqual([]);

    expect(await conversationOf(CONV_A2)).toMatchObject({ user_id: MEMBER_A2, title: "New Chat", turn_lock_until: null });
  });

  it("a member cannot set the turn lock or reassign user_id on their own conversation either", async () => {
    await expect(
      asMember(MEMBER_A, () =>
        db.query("UPDATE copilot_conversations SET turn_lock_until = now() + interval '100 years' WHERE id = $1", [
          CONV_A,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asMember(MEMBER_A, () =>
        db.query("UPDATE copilot_conversations SET user_id = $1 WHERE id = $2", [MEMBER_A2, CONV_A]),
      ),
    ).rejects.toThrow(/permission denied/i);
    expect(await conversationOf(CONV_A)).toMatchObject({ user_id: MEMBER_A, turn_lock_until: null });
  });

  it("a member can rename and pin their own conversation", async () => {
    const updated = await asMember(MEMBER_A, () =>
      db.query<{ id: string }>(
        "UPDATE copilot_conversations SET title = 'Pipeline review', is_pinned = true WHERE id = $1 RETURNING id",
        [CONV_A],
      ),
    );
    expect(updated).toEqual([{ id: CONV_A }]);
    expect(await conversationOf(CONV_A)).toMatchObject({ title: "Pipeline review", is_pinned: true });
  });

  it("a member can create their own page conversation but not one for another member", async () => {
    const own = await asMember(MEMBER_A, () =>
      db.query<{ id: string }>(
        "INSERT INTO copilot_conversations (organization_id, user_id, page_key) VALUES ($1, $2, 'leads') RETURNING id",
        [ORG_A, MEMBER_A],
      ),
    );
    expect(own).toHaveLength(1);

    await expect(
      asMember(MEMBER_A, () =>
        db.query("INSERT INTO copilot_conversations (organization_id, user_id, page_key) VALUES ($1, $2, 'deals')", [
          ORG_A,
          MEMBER_A2,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
    const preCreated = await db.query("SELECT id FROM copilot_conversations WHERE user_id = $1 AND page_key = 'deals'", [
      MEMBER_A2,
    ]);
    expect(preCreated).toEqual([]);
    await db.query("DELETE FROM copilot_conversations WHERE id = $1", [own[0].id]);
  });

  it("a member cannot delete another member's conversation", async () => {
    const deleted = await asMember(MEMBER_A, () =>
      db.query("DELETE FROM copilot_conversations WHERE id = $1 RETURNING id", [CONV_A2]),
    );
    expect(deleted).toEqual([]);
    expect(await conversationOf(CONV_A2)).toMatchObject({ user_id: MEMBER_A2 });
  });

  it("the service role still sets and clears the turn lock", async () => {
    const locked = await asServiceRole(() =>
      db.query(
        "UPDATE copilot_conversations SET turn_lock_until = now() + interval '150 seconds', turn_lock_token = gen_random_uuid() WHERE id = $1 RETURNING id",
        [CONV_A2],
      ),
    );
    expect(locked).toEqual([{ id: CONV_A2 }]);
    const cleared = await asServiceRole(() =>
      db.query("UPDATE copilot_conversations SET turn_lock_until = NULL, turn_lock_token = NULL WHERE id = $1 RETURNING id", [
        CONV_A2,
      ]),
    );
    expect(cleared).toEqual([{ id: CONV_A2 }]);
  });
});

describe("migration 044: the service role", () => {
  it("can INSERT, UPDATE and DELETE messages", async () => {
    const inserted = await asServiceRole(() =>
      db.query<{ id: string }>(
        `INSERT INTO copilot_messages (conversation_id, organization_id, role, content, parts, message_id, seq)
         VALUES ($1, $2, 'assistant', 'server reply', '[{"type":"text","text":"server reply"}]'::jsonb, 'msg-1', 1)
         RETURNING id`,
        [CONV_A, ORG_A],
      ),
    );
    expect(inserted).toHaveLength(1);
    const id = inserted[0].id;

    const updated = await asServiceRole(() =>
      db.query("UPDATE copilot_messages SET content = 'edited' WHERE id = $1 RETURNING id", [id]),
    );
    expect(updated).toEqual([{ id }]);

    // The member sees the server-written row.
    const seen = await asMember(MEMBER_A, () =>
      db.query<{ content: string; message_id: string }>(
        "SELECT content, message_id FROM copilot_messages WHERE id = $1",
        [id],
      ),
    );
    expect(seen).toEqual([{ content: "edited", message_id: "msg-1" }]);

    const deleted = await asServiceRole(() =>
      db.query("DELETE FROM copilot_messages WHERE id = $1 RETURNING id", [id]),
    );
    expect(deleted).toEqual([{ id }]);
  });
});
