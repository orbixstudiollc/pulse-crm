import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";

const MIGRATION = "043_copilot_v2_artifacts_memory_notifications.sql";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_A2 = "33333333-3333-4333-8333-333333333333";
const USER_B = "22222222-2222-4222-8222-222222222222";

let db: TestDb;

async function insertGuidance(org: string, user: string, isActive = true): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO copilot_memory (organization_id, user_id, type, title, content, is_active)
     VALUES ($1, $2, 'guidance', 'rule', 'Always be brief', $3) RETURNING id`,
    [org, user, isActive],
  );
  return rows[0].id;
}

async function activeGuidanceCount(org: string): Promise<number> {
  const rows = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM copilot_memory
      WHERE organization_id = $1 AND type = 'guidance' AND is_active`,
    [org],
  );
  return rows[0].n;
}

async function asMember<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE authenticated");
  await db.setUser(uid);
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
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG_A}', 'Org A', 'org-a'), ('${ORG_B}', 'Org B', 'org-b');
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_A}', 'a@x.test'), ('${USER_A2}', 'a2@x.test'), ('${USER_B}', 'b@x.test');
    INSERT INTO profiles (id, organization_id, email) VALUES
      ('${USER_A}', '${ORG_A}', 'a@x.test'),
      ('${USER_A2}', '${ORG_A}', 'a2@x.test'),
      ('${USER_B}', '${ORG_B}', 'b@x.test');
    -- Legacy 021 memory rows, written before 043 exists.
    INSERT INTO copilot_memory (organization_id, user_id, type, title, content, source) VALUES
      ('${ORG_A}', '${USER_A}', 'custom', 'scraped', 'x', 'website'),
      ('${ORG_A}', '${USER_A}', 'custom', 'typed', 'x', 'manual'),
      ('${ORG_A}', '${USER_A}', 'custom', 'nosource', 'x', NULL);
  `);
  await db.applyMigration(MIGRATION);
  // Idempotent: a second apply must succeed and change nothing.
  await db.applyMigration(MIGRATION);
});

afterAll(async () => {
  await db?.close();
});

describe("043 apply", () => {
  it("applies twice without error and creates the new tables", async () => {
    await expect(db.applyMigration(MIGRATION)).resolves.toBeUndefined();
    const rows = await db.query<{ a: string | null; n: string | null }>(
      "SELECT to_regclass('public.copilot_artifacts')::text AS a, to_regclass('public.notifications')::text AS n",
    );
    expect(rows[0]).toEqual({ a: "copilot_artifacts", n: "notifications" });
  });

  it("copilot_tasks has prompt, locked_at, last_error and last_artifact_id", async () => {
    const rows = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'copilot_tasks'
          AND column_name IN ('prompt', 'locked_at', 'last_error', 'last_artifact_id')
        ORDER BY column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual(["last_artifact_id", "last_error", "locked_at", "prompt"]);
  });
});

describe("copilot_memory source", () => {
  it("backfills legacy values: website -> scrape, manual / NULL -> user", async () => {
    const rows = await db.query<{ title: string; source: string }>(
      "SELECT title, source FROM copilot_memory WHERE title IN ('scraped', 'typed', 'nosource') ORDER BY title",
    );
    expect(rows).toEqual([
      { title: "nosource", source: "user" },
      { title: "scraped", source: "scrape" },
      { title: "typed", source: "user" },
    ]);
  });

  it("defaults to user, accepts copilot, maps legacy client values, rejects unknown", async () => {
    const rows = await db.query<{ source: string }>(
      `INSERT INTO copilot_memory (organization_id, user_id, type, title, content, source) VALUES
         ($1, $2, 'custom', 'd', 'x', DEFAULT),
         ($1, $2, 'custom', 'c', 'x', 'copilot'),
         ($1, $2, 'custom', 'w', 'x', 'website')
       RETURNING source`,
      [ORG_B, USER_B],
    );
    expect(rows.map((r) => r.source)).toEqual(["user", "copilot", "scrape"]);
    await expect(
      db.query(
        "INSERT INTO copilot_memory (organization_id, user_id, type, title, content, source) VALUES ($1, $2, 'custom', 't', 'x', 'bogus')",
        [ORG_B, USER_B],
      ),
    ).rejects.toThrow(/copilot_memory_source_check/);
  });
});

describe("guidance cap", () => {
  beforeEach(async () => {
    await db.exec(`DELETE FROM copilot_memory WHERE type = 'guidance'`);
  });

  it("allows 10 active guidance rows, rejects the 11th, and allows it after deactivating one", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push(await insertGuidance(ORG_A, USER_A));
    expect(await activeGuidanceCount(ORG_A)).toBe(10);

    await expect(insertGuidance(ORG_A, USER_A)).rejects.toThrow("guidance_cap_exceeded");
    expect(await activeGuidanceCount(ORG_A)).toBe(10);

    await db.query("UPDATE copilot_memory SET is_active = false WHERE id = $1", [ids[0]]);
    await expect(insertGuidance(ORG_A, USER_A)).resolves.toMatch(/^[0-9a-f-]{36}$/);
    expect(await activeGuidanceCount(ORG_A)).toBe(10);
  });

  it("counts per org, ignores inactive rows, and blocks re-activation past the cap", async () => {
    for (let i = 0; i < 10; i++) await insertGuidance(ORG_A, USER_A);
    const inactive = await insertGuidance(ORG_A, USER_A, false);
    // Another org is unaffected.
    await expect(insertGuidance(ORG_B, USER_B)).resolves.toBeTruthy();
    // Editing an already-active row (it excludes itself) is fine at the cap.
    await expect(
      db.query(
        "UPDATE copilot_memory SET content = 'edited' WHERE id = (SELECT id FROM copilot_memory WHERE organization_id = $1 AND type = 'guidance' AND is_active LIMIT 1)",
        [ORG_A],
      ),
    ).resolves.toBeDefined();
    await expect(
      db.query("UPDATE copilot_memory SET is_active = true WHERE id = $1", [inactive]),
    ).rejects.toThrow("guidance_cap_exceeded");
  });

  it("applies to members writing through RLS too", async () => {
    for (let i = 0; i < 10; i++) await insertGuidance(ORG_A, USER_A);
    await expect(asMember(USER_A, () => insertGuidance(ORG_A, USER_A))).rejects.toThrow(
      "guidance_cap_exceeded",
    );
  });

  it("holds the per-org advisory lock for the whole transaction, so a second writer is serialised", async () => {
    for (let i = 0; i < 9; i++) await insertGuidance(ORG_A, USER_A);

    // Writer 1: inserts the 10th row and keeps its transaction open.
    await db.exec("BEGIN");
    try {
      await insertGuidance(ORG_A, USER_A);
      const locks = await db.query<{ held: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_locks
            WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted
              AND ((classid::bigint << 32) | objid::bigint) = hashtext('copilot_guidance_' || $1)::bigint
         ) AS held`,
        [ORG_A],
      );
      // Any other connection's pg_advisory_xact_lock on this key blocks here
      // until writer 1 commits; once it runs, its count sees all 10 rows.
      expect(locks[0].held).toBe(true);

      // Writer 2, serialised behind writer 1 (same lock key), cannot reach 11.
      await expect(insertGuidance(ORG_A, USER_A)).rejects.toThrow("guidance_cap_exceeded");
    } finally {
      await db.exec("ROLLBACK");
    }

    // Rolled back: only the 9 committed rows remain, and the lock is released.
    expect(await activeGuidanceCount(ORG_A)).toBe(9);
    const after = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()",
    );
    expect(after[0].n).toBe(0);

    // Two sequential committed transactions: the first takes the 10th slot,
    // the second (which starts after the first commits) is rejected.
    await db.exec("BEGIN");
    await insertGuidance(ORG_A, USER_A);
    await db.exec("COMMIT");
    await db.exec("BEGIN");
    await expect(insertGuidance(ORG_A, USER_A)).rejects.toThrow("guidance_cap_exceeded");
    await db.exec("ROLLBACK");
    expect(await activeGuidanceCount(ORG_A)).toBe(10);
  });

  it("does not take the lock for non-guidance rows", async () => {
    await db.exec("BEGIN");
    try {
      await db.query(
        "INSERT INTO copilot_memory (organization_id, user_id, type, title, content) VALUES ($1, $2, 'custom', 't', 'x')",
        [ORG_A, USER_A],
      );
      const rows = await db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()",
      );
      expect(rows[0].n).toBe(0);
    } finally {
      await db.exec("ROLLBACK");
    }
  });
});

describe("copilot_artifacts constraints", () => {
  const insertArtifact = (kind: string, content: unknown, title = "Draft") =>
    db.query<{ id: string }>(
      "INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, $2, $3, $4::jsonb) RETURNING id",
      [ORG_A, kind, title, JSON.stringify(content)],
    );

  it("accepts a valid artifact", async () => {
    await expect(insertArtifact("email_draft", { subject: "Hi", body: "Hello" })).resolves.toHaveLength(1);
  });

  it("rejects kind 'pdf'", async () => {
    await expect(insertArtifact("pdf", { a: 1 })).rejects.toThrow(/copilot_artifacts_kind_check/);
  });

  it("rejects 200 KB content", async () => {
    await expect(insertArtifact("report", { text: "x".repeat(200 * 1024) })).rejects.toThrow(
      /copilot_artifacts_content_check/,
    );
  });

  it("rejects an empty title", async () => {
    await expect(insertArtifact("note", { a: 1 }, "")).rejects.toThrow(/copilot_artifacts_title_check/);
  });

  it("is org-scoped for members: own org visible and insertable, other org neither", async () => {
    await db.query(
      "INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, 'note', 'B note', '{}')",
      [ORG_B],
    );
    const seen = await asMember(USER_A, () =>
      db.query<{ organization_id: string }>("SELECT DISTINCT organization_id FROM copilot_artifacts"),
    );
    expect(seen.map((r) => r.organization_id)).toEqual([ORG_A]);

    await expect(
      asMember(USER_A, () =>
        db.query("INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, 'note', 'n', '{}')", [
          ORG_A,
        ]),
      ),
    ).resolves.toBeDefined();
    await expect(
      asMember(USER_A, () =>
        db.query("INSERT INTO copilot_artifacts (organization_id, kind, title, content) VALUES ($1, 'note', 'n', '{}')", [
          ORG_B,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("notifications", () => {
  it("rejects kind 'other'", async () => {
    await expect(
      db.query("INSERT INTO notifications (organization_id, kind, title) VALUES ($1, 'other', 't')", [ORG_A]),
    ).rejects.toThrow(/notifications_kind_check/);
  });

  it("member INSERT fails under SET ROLE authenticated (server inserts only)", async () => {
    await expect(
      asMember(USER_A, () =>
        db.query(
          "INSERT INTO notifications (organization_id, user_id, kind, title) VALUES ($1, $2, 'task_result', 't')",
          [ORG_A, USER_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("members see org-wide and own rows, and can mark only their own rows read", async () => {
    await db.exec("DELETE FROM notifications");
    await db.query(
      `INSERT INTO notifications (organization_id, user_id, kind, title) VALUES
         ($1, NULL, 'approval_pending', 'everyone'),
         ($1, $2, 'task_result', 'mine'),
         ($1, $3, 'task_result', 'colleague'),
         ($4, NULL, 'task_result', 'other org')`,
      [ORG_A, USER_A, USER_A2, ORG_B],
    );

    const seen = await asMember(USER_A, () =>
      db.query<{ title: string }>("SELECT title FROM notifications ORDER BY title"),
    );
    expect(seen.map((r) => r.title)).toEqual(["everyone", "mine"]);

    const updated = await asMember(USER_A, () =>
      db.query<{ title: string }>("UPDATE notifications SET read_at = now() RETURNING title"),
    );
    expect(updated.map((r) => r.title)).toEqual(["mine"]);

    const read = await db.query<{ title: string }>(
      "SELECT title FROM notifications WHERE read_at IS NOT NULL ORDER BY title",
    );
    expect(read.map((r) => r.title)).toEqual(["mine"]);
  });
});
