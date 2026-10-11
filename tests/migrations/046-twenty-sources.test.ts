import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";
const CONN = "44444444-4444-4444-8444-444444444444";
const CHAT = "55555555-5555-4555-8555-555555555555";
let db: TestDb;

describe("Twenty connection and source migrations", () => {
  beforeAll(async () => {
    db = await createTestDb();
    await db.exec(`
      ALTER TABLE auth.users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
        SELECT jsonb_build_object('is_anonymous',coalesce((SELECT is_anonymous FROM auth.users WHERE id=auth.uid()),false));
      $$;
      INSERT INTO auth.users(id,email,is_anonymous) VALUES ('${OWNER}','owner@test.com',false),('${MEMBER}','member@test.com',false),('${GUEST}','guest@guest.local',true);
      INSERT INTO organizations(id,name,slug) VALUES ('${ORG}','A','a'),('${OTHER}','B','b');
      INSERT INTO profiles(id,organization_id,email,role) VALUES ('${OWNER}','${ORG}','owner@test.com','owner'),('${MEMBER}','${ORG}','member@test.com','member'),('${GUEST}','${ORG}','guest@guest.local','owner');
    `);
    await db.applyMigration("042_copilot_v2_history_approvals.sql");
    await db.applyMigration("043_copilot_v2_artifacts_memory_notifications.sql");
    await db.applyMigration("044_copilot_messages_server_write.sql");
    await db.applyMigration("045_twenty_connections.sql");
    await db.applyMigration("046_copilot_twenty_sources.sql");
    await db.exec(`
      INSERT INTO twenty_connections(id,organization_id,owner_id,workspace_url,workspace_id) VALUES ('${CONN}','${ORG}','${OWNER}','https://orbix-sales.twenty.com','${OTHER}');
      INSERT INTO twenty_connection_credentials(connection_id,organization_id,api_key_ciphertext) VALUES ('${CONN}','${ORG}','encrypted-test-key');
      INSERT INTO copilot_conversations(id,organization_id,user_id,crm_source,integration_connection_id) VALUES ('${CHAT}','${ORG}','${OWNER}','twenty','${CONN}');
      INSERT INTO copilot_messages(conversation_id,organization_id,role,content) VALUES ('${CHAT}','${ORG}','assistant','Twenty-only secret');
      INSERT INTO copilot_artifacts(organization_id,user_id,kind,title,content,crm_source,connection_id) VALUES ('${ORG}','${OWNER}','note','Twenty draft','{}','twenty','${CONN}'),('${ORG}','${OWNER}','note','Pulse draft','{}','pulse',NULL);
      INSERT INTO copilot_memory(organization_id,user_id,type,title,content,source,crm_source,connection_id) VALUES ('${ORG}','${OWNER}','custom','Twenty memory','Twenty-only secret','user','twenty','${CONN}');
    `);
  });
  afterAll(async () => { await db.close(); });

  async function asUser(user: string, fn: () => Promise<void>) {
    await db.setUser(user); await db.exec("SET ROLE authenticated");
    try { await fn(); } finally { await db.exec("RESET ROLE"); }
  }
  it("starts with writes and scheduled AI disabled", async () => {
    const rows = await db.query<{ writes_enabled: boolean; monthly_token_cap: number | null }>("SELECT writes_enabled,monthly_token_cap FROM twenty_connections");
    expect(rows[0]).toEqual({ writes_enabled: false, monthly_token_cap: null });
  });
  it("never grants browser clients credential access", async () => {
    await asUser(OWNER, async () => {
      await expect(db.query("SELECT * FROM twenty_connection_credentials")).rejects.toThrow(/permission denied/);
      await expect(db.query("UPDATE twenty_connections SET writes_enabled=true")).rejects.toThrow(/permission denied/);
    });
  });
  it("restricts Twenty data to non-guest owners/admins while preserving Pulse access", async () => {
    for (const user of [MEMBER, GUEST]) await asUser(user, async () => {
      expect((await db.query("SELECT id FROM twenty_connections"))).toHaveLength(0);
      expect((await db.query("SELECT id FROM copilot_memory"))).toHaveLength(0);
      expect((await db.query("SELECT id FROM copilot_artifacts WHERE crm_source='twenty'"))).toHaveLength(0);
      expect((await db.query("SELECT id FROM copilot_artifacts WHERE crm_source='pulse'"))).toHaveLength(1);
    });
    await asUser(OWNER, async () => {
      expect((await db.query("SELECT id FROM copilot_conversations"))).toHaveLength(1);
      expect((await db.query("SELECT id FROM copilot_messages"))).toHaveLength(1);
      expect((await db.query("SELECT id FROM copilot_memory"))).toHaveLength(1);
    });
  });
  it("enforces immutable conversation/artifact/memory sources", async () => {
    await expect(db.query(`UPDATE copilot_conversations SET crm_source='pulse',integration_connection_id=NULL WHERE id='${CHAT}'`)).rejects.toThrow("crm_source_is_immutable");
    await expect(db.query("UPDATE copilot_artifacts SET crm_source='pulse',connection_id=NULL WHERE crm_source='twenty'")).rejects.toThrow("crm_source_is_immutable");
    await expect(db.query("UPDATE copilot_memory SET crm_source='pulse',connection_id=NULL WHERE crm_source='twenty'")).rejects.toThrow("crm_source_is_immutable");
  });
  it("prevents connection replacement from changing the workspace behind saved history", async () => {
    await expect(db.query(`UPDATE twenty_connections SET workspace_url='https://other.twenty.com' WHERE id='${CONN}'`)).rejects.toThrow("twenty_workspace_identity_is_immutable");
    await expect(db.query(`SELECT save_twenty_connection('${CONN}','${ORG}','${OWNER}','https://orbix-sales.twenty.com','${ORG}','replacement-key',true,1)`)).rejects.toThrow("twenty_workspace_identity_is_immutable");
    const [credential] = await db.query<{ api_key_ciphertext: string }>("SELECT api_key_ciphertext FROM twenty_connection_credentials");
    expect(credential.api_key_ciphertext).toBe("encrypted-test-key");
  });
  it("prevents cross-organization connection references and Pulse record links on Twenty drafts", async () => {
    await expect(db.query(`INSERT INTO copilot_artifacts(organization_id,kind,title,content,crm_source,connection_id) VALUES ('${OTHER}','note','Bad','{}','twenty','${CONN}')`)).rejects.toThrow(/foreign key/);
    await expect(db.query(`INSERT INTO copilot_artifacts(organization_id,kind,title,content,crm_source,connection_id,linked_record_id) VALUES ('${ORG}','note','Bad','{}','twenty','${CONN}','${CHAT}')`)).rejects.toThrow(/check constraint/);
  });
  it("removes history/artifact/memory access immediately after demotion", async () => {
    await db.exec(`UPDATE profiles SET role='member' WHERE id='${OWNER}'`);
    try {
      await asUser(OWNER, async () => {
        expect((await db.query("SELECT id FROM copilot_conversations"))).toHaveLength(0);
        expect((await db.query("SELECT id FROM copilot_messages"))).toHaveLength(0);
        expect((await db.query("SELECT id FROM copilot_artifacts WHERE crm_source='twenty'"))).toHaveLength(0);
        expect((await db.query("SELECT id FROM copilot_memory"))).toHaveLength(0);
      });
    } finally { await db.exec(`UPDATE profiles SET role='owner' WHERE id='${OWNER}'`); }
  });
});
