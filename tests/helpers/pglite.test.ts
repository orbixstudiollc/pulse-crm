import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const SCRATCH_DIR = path.resolve(process.cwd(), "tests", "fixtures", `.tmp-pglite-${process.pid}`);
const SCRATCH_FILES = ["syntax-error.sql", "runtime-error.sql", "explicit-tx.sql", "plain.sql"];

// applyMigration resolves names against supabase/migrations, so scratch
// migrations are addressed relative to that directory.
const scratchName = (file: string) => path.relative(MIGRATIONS_DIR, path.join(SCRATCH_DIR, file));

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

async function tableExists(db: TestDb, name: string): Promise<boolean> {
  const rows = await db.query<{ ok: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS ok",
    [`public.${name}`],
  );
  return rows[0].ok;
}

let db: TestDb;

beforeAll(async () => {
  await mkdir(SCRATCH_DIR, { recursive: true });
  await writeFile(
    path.join(SCRATCH_DIR, "syntax-error.sql"),
    "CREATE TABLE harness_syntax_before (id int);\nCREATE TABEL harness_syntax_after (id int);\n",
  );
  await writeFile(
    path.join(SCRATCH_DIR, "runtime-error.sql"),
    "CREATE TABLE harness_runtime_before (id int);\nINSERT INTO harness_runtime_missing VALUES (1);\n",
  );
  await writeFile(
    path.join(SCRATCH_DIR, "explicit-tx.sql"),
    "BEGIN;\nCREATE TABLE harness_explicit (id int);\nCOMMIT;\n",
  );
  await writeFile(
    path.join(SCRATCH_DIR, "plain.sql"),
    "CREATE TABLE harness_plain (id int);\n",
  );
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
  for (const file of SCRATCH_FILES) {
    await rm(path.join(SCRATCH_DIR, file), { force: true });
  }
  await rm(SCRATCH_DIR, { recursive: true, force: true });
});

describe("createTestDb baseline", () => {
  it.each([
    "copilot_conversations",
    "copilot_messages",
    "copilot_memory",
    "copilot_tasks",
    "ai_settings",
    "icp_profiles",
    "profiles",
    "leads",
  ])("has baseline table %s", async (table) => {
    expect(await tableExists(db, table)).toBe(true);
  });

  it("has update_updated_at and the stub roles", async () => {
    const fn = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'update_updated_at'",
    );
    expect(fn[0].n).toBe(1);
    const roles = await db.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname",
    );
    expect(roles.map((r) => r.rolname)).toEqual(["anon", "authenticated", "service_role"]);
  });

  it("has pgcrypto", async () => {
    const rows = await db.query<{ ok: boolean }>(
      "SELECT length(encode(digest('x', 'sha256'), 'hex')) = 64 AS ok",
    );
    expect(rows[0].ok).toBe(true);
  });
});

describe("applyMigration", () => {
  it("rejects a file with a syntax error and leaves nothing behind", async () => {
    await expect(db.applyMigration(scratchName("syntax-error.sql"))).rejects.toThrow(/syntax/i);
    expect(await tableExists(db, "harness_syntax_before")).toBe(false);
    expect(await tableExists(db, "harness_syntax_after")).toBe(false);
  });

  it("rolls back a table created earlier in the file when a later statement fails", async () => {
    await expect(db.applyMigration(scratchName("runtime-error.sql"))).rejects.toThrow(
      /harness_runtime_missing/,
    );
    expect(await tableExists(db, "harness_runtime_before")).toBe(false);
  });

  it("stays usable after a failed migration", async () => {
    const rows = await db.query<{ one: number }>("SELECT 1 AS one");
    expect(rows).toEqual([{ one: 1 }]);
  });

  it("commits a file without its own transaction", async () => {
    await db.applyMigration(scratchName("plain.sql"));
    expect(await tableExists(db, "harness_plain")).toBe(true);
  });

  it("commits a file that already wraps itself in BEGIN/COMMIT", async () => {
    await db.applyMigration(scratchName("explicit-tx.sql"));
    expect(await tableExists(db, "harness_explicit")).toBe(true);
  });

  it("reads a real repo migration and rejects it when a dependency is missing", async () => {
    // 038 needs ai_usage_log (011), which the baseline does not carry.
    await expect(db.applyMigration("038_shared_ai_budget.sql")).rejects.toThrow(/ai_usage_log/);
    expect(await tableExists(db, "ai_shared_budget")).toBe(false);
  });
});

describe("setUser", () => {
  it("makes auth.uid() return the uuid", async () => {
    await db.setUser(USER_A);
    const rows = await db.query<{ uid: string }>("SELECT auth.uid()::text AS uid");
    expect(rows[0].uid).toBe(USER_A);
  });

  it("clears auth.uid() with null", async () => {
    await db.setUser(USER_A);
    await db.setUser(null);
    const rows = await db.query<{ uid: string | null }>("SELECT auth.uid()::text AS uid");
    expect(rows[0].uid).toBeNull();
  });
});

describe("baseline org RLS", () => {
  it("lets a member of org A see only org A rows as the authenticated role", async () => {
    await db.setUser(null);
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${USER_A}', 'a@x.test'), ('${USER_B}', 'b@x.test');
      INSERT INTO organizations (id, name, slug) VALUES
        ('${ORG_A}', 'A', 'a'), ('${ORG_B}', 'B', 'b');
      INSERT INTO profiles (id, organization_id, email) VALUES
        ('${USER_A}', '${ORG_A}', 'a@x.test'), ('${USER_B}', '${ORG_B}', 'b@x.test');
      INSERT INTO copilot_memory (organization_id, user_id, type, title, content) VALUES
        ('${ORG_A}', '${USER_A}', 'custom', 'a-mem', 'x'),
        ('${ORG_B}', '${USER_B}', 'custom', 'b-mem', 'y');
    `);

    const asSuperuser = await db.query("SELECT 1 FROM copilot_memory");
    expect(asSuperuser).toHaveLength(2);

    await db.exec("SET ROLE authenticated");
    try {
      await db.setUser(USER_A);
      const seenByA = await db.query<{ title: string }>("SELECT title FROM copilot_memory");
      expect(seenByA.map((r) => r.title)).toEqual(["a-mem"]);

      await db.setUser(USER_B);
      const seenByB = await db.query<{ title: string }>("SELECT title FROM copilot_memory");
      expect(seenByB.map((r) => r.title)).toEqual(["b-mem"]);
    } finally {
      await db.exec("RESET ROLE");
      await db.setUser(null);
    }
  });
});
