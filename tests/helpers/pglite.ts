// In-process Postgres (PGlite) harness for testing supabase/migrations/*.sql.
//
//   const db = await createTestDb();
//   await db.applyMigration("042_copilot_foo.sql");
//   await db.setUser(userId);          // auth.uid() now returns userId
//   await db.query("SELECT ...");
//   await db.close();
//
// Bootstrap (before the baseline fixture): roles anon / authenticated /
// service_role, schema auth with auth.users, auth.uid() and auth.role(),
// extension pgcrypto, and update_updated_at(). Then tests/fixtures/
// copilot-baseline.sql recreates the pre-042 tables with their org RLS.
//
// The connection is a superuser, which bypasses RLS. To exercise policies,
// seed first, then `exec("SET ROLE authenticated")` and setUser(uid), and
// `exec("RESET ROLE")` afterwards. Tables in public are granted to the three
// roles by default, as on Supabase.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const BASELINE_FILE = path.join(REPO_ROOT, "tests", "fixtures", "copilot-baseline.sql");

const BOOTSTRAP_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- app.uid is set by setUser(); app.role may be set to 'service_role' by a test.
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;

CREATE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('app.role', true), ''),
    CASE WHEN auth.uid() IS NULL THEN 'anon' ELSE 'authenticated' END
  )
$$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`;

export interface TestDb {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  applyMigration(fileName: string): Promise<void>;
  setUser(uid: string | null): Promise<void>;
  close(): Promise<void>;
}

const hasExplicitTransaction = (sql: string) =>
  /^\s*BEGIN\s*;/im.test(sql) && /^\s*COMMIT\s*;/im.test(sql);

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.waitReady;

  async function exec(sql: string): Promise<void> {
    await pg.exec(sql);
  }

  async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await pg.query<T>(sql, params);
    return result.rows;
  }

  async function applyMigration(fileName: string): Promise<void> {
    const sql = await readFile(path.join(MIGRATIONS_DIR, fileName), "utf8");
    const script = hasExplicitTransaction(sql) ? sql : `BEGIN;\n${sql}\nCOMMIT;`;
    try {
      await pg.exec(script);
    } catch (err) {
      // A failure inside BEGIN leaves the session in an aborted transaction.
      await pg.exec("ROLLBACK").catch(() => undefined);
      throw err;
    }
  }

  async function setUser(uid: string | null): Promise<void> {
    await pg.query("SELECT set_config('app.uid', $1, false)", [uid ?? ""]);
  }

  async function close(): Promise<void> {
    await pg.close();
  }

  await pg.exec(BOOTSTRAP_SQL);
  await pg.exec(await readFile(BASELINE_FILE, "utf8"));

  return { exec, query, applyMigration, setUser, close };
}
