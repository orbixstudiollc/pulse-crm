import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestDb, type TestDb } from "../helpers/pglite";
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: vi.fn() }));
import { claimCreationReservations, finishCreationReservations } from "@/lib/twenty/creation-reservations";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const COMPANY = "44444444-4444-4444-8444-444444444444";
const PERSON = "55555555-5555-4555-8555-555555555555";
let db: TestDb;
let sequence = 0;

const rpcClient = { rpc: async (name: string, args: Record<string, unknown>) => {
  try {
    const claim = name === "twenty_claim_creation_reservations";
    const sql = claim
      ? "SELECT public.twenty_claim_creation_reservations($1,$2,$3,$4,ARRAY(SELECT jsonb_array_elements_text($5::jsonb))) AS value"
      : "SELECT public.twenty_finish_creation_reservations($1,$2,$3,$4,ARRAY(SELECT jsonb_array_elements_text($5::jsonb)::uuid),$6,$7::jsonb) AS value";
    const params = [args.p_org, args.p_connection, args.p_user, args.p_hash, JSON.stringify(claim ? args.p_keys : args.p_ids), ...(claim ? [] : [args.p_state, JSON.stringify(args.p_external_ids)])];
    const rows = await db.query<{ value: unknown }>(sql, params);
    return { data: rows[0].value, error: null };
  } catch (error) { return { data: null, error: { message: (error as Error).message } }; }
} } as unknown as SupabaseClient;

async function approval(hash: string, email = "jane@acme.test", domain = "acme.test", companyId: string | null = null, status = "approved") {
  return db.query("INSERT INTO copilot_approvals(organization_id,user_id,conversation_id,tool_call_id,tool_name,input,diff,source,status,crm_source,connection_id,connection_revision,resolved_at) VALUES($1,$2,$3,$4,'twenty_quick_lead',$5::jsonb,$6::jsonb,'chat',$7,'twenty',$8,1,now()) RETURNING id", [ORG, USER, CONVERSATION, `call-${++sequence}`, JSON.stringify({ firstName: "Jane", lastName: "Doe", email, companyName: "Acme", companyDomain: domain }), JSON.stringify({ kind: "create", recordType: "Twenty lead bundle", fields: [], approvalBinding: { crmSource: "twenty", connectionId: CONNECTION, connectionRevision: 1, userId: USER, payloadHash: hash, preconditions: { companyId } } }), status, CONNECTION]);
}
const claim = (hash: string, keys = ["email:jane@acme.test", "domain:acme.test"]) => claimCreationReservations({ orgId: ORG, userId: USER, connectionId: CONNECTION, approvalHash: hash, keys }, rpcClient);
const reservations = () => db.query<{ reservation_key: string; status: string; external_ids: Record<string, string> }>("SELECT reservation_key,status,external_ids FROM twenty_creation_reservations ORDER BY reservation_key");

beforeAll(async () => {
  db = await createTestDb();
  await db.exec("ALTER TABLE auth.users ADD COLUMN is_anonymous boolean DEFAULT false; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;");
  await db.applyMigration("042_copilot_v2_history_approvals.sql");
  await db.applyMigration("043_copilot_v2_artifacts_memory_notifications.sql");
  await db.applyMigration("044_copilot_messages_server_write.sql");
  await db.applyMigration("045_twenty_connections.sql");
  await db.applyMigration("046_copilot_twenty_sources.sql");
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${USER}','owner@example.test'); INSERT INTO organizations(id,name,slug) VALUES('${ORG}','Org','org'); INSERT INTO profiles(id,organization_id,email,role) VALUES('${USER}','${ORG}','owner@example.test','owner'); INSERT INTO twenty_connections(id,organization_id,owner_id,workspace_url,workspace_id) VALUES('${CONNECTION}','${ORG}','${USER}','https://orbix-sales.twenty.com','${CONNECTION}'); INSERT INTO copilot_conversations(id,organization_id,user_id,crm_source,integration_connection_id) VALUES('${CONVERSATION}','${ORG}','${USER}','twenty','${CONNECTION}');`);
});
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec("DELETE FROM twenty_creation_reservation_events; DELETE FROM twenty_creation_reservations; DELETE FROM copilot_approvals; UPDATE twenty_connections SET revision=1,status='verified';"); });

describe("durable creation fences", () => {
  it("allows one approved creation across simultaneous approvals for the same email/domain", async () => {
    await approval("a".repeat(64)); await approval("b".repeat(64));
    const results = await Promise.allSettled([claim("a".repeat(64)), claim("b".repeat(64))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await reservations()).toHaveLength(2);
  });
  it("requires an actual approved owner/source/connection-bound payload and matching keys", async () => {
    await approval("a".repeat(64), undefined, undefined, null, "pending");
    await expect(claim("a".repeat(64))).rejects.toThrow("creation_reservation_unconfirmed");
    await approval("b".repeat(64));
    await expect(claim("b".repeat(64), ["email:other@example.test"])).rejects.toThrow("creation_reservation_unconfirmed");
    await db.exec("UPDATE twenty_connections SET revision=2;");
    await expect(claim("b".repeat(64))).rejects.toThrow("creation_reservation_unconfirmed");
    expect(await reservations()).toEqual([]);
  });
  it("rolls back all newly acquired keys if a later key is busy", async () => {
    await approval("a".repeat(64)); await claim("a".repeat(64));
    await approval("b".repeat(64), "jane@acme.test", "other.test");
    await expect(claim("b".repeat(64), ["email:jane@acme.test", "domain:other.test"])).rejects.toThrow("creation_reserved_requires_review");
    expect((await reservations()).map((r) => r.reservation_key)).toEqual(["domain:acme.test", "email:jane@acme.test"]);
  });
  it("retains completed IDs and uncertain keys, and never automatically retries them", async () => {
    await approval("a".repeat(64)); const held = await claim("a".repeat(64));
    await finishCreationReservations(held, "unknown_outcome", { companyId: COMPANY }, rpcClient);
    expect(await reservations()).toEqual([
      { reservation_key: "domain:acme.test", status: "completed", external_ids: { companyId: COMPANY } },
      { reservation_key: "email:jane@acme.test", status: "unknown_outcome", external_ids: { companyId: COMPANY } },
    ]);
    await approval("b".repeat(64));
    await expect(claim("b".repeat(64))).rejects.toThrow("creation_reserved_requires_review");
    const events = await db.query<{ event: string }>("SELECT event FROM twenty_creation_reservation_events ORDER BY created_at,id");
    expect(events.map((e) => e.event).sort()).toEqual(["claimed", "claimed", "completed", "unknown_outcome"]);
  });
  it("releases only untouched keys after a known rejection, preserving a created company", async () => {
    await approval("a".repeat(64)); const held = await claim("a".repeat(64));
    await finishCreationReservations(held, "known_failure", { companyId: COMPANY }, rpcClient);
    expect((await reservations()).map((r) => r.status)).toEqual(["completed", "released"]);
    await approval("b".repeat(64), "jane@acme.test", "acme.test", COMPANY);
    const next = await claim("b".repeat(64), ["email:jane@acme.test"]);
    await finishCreationReservations(next, "success", { personId: PERSON }, rpcClient);
    expect((await reservations()).map((r) => r.status)).toEqual(["completed", "completed"]);
  });
  it("releases all keys after a known rejection with no external creation", async () => {
    await approval("a".repeat(64)); const held = await claim("a".repeat(64));
    await finishCreationReservations(held, "known_failure", {}, rpcClient);
    expect((await reservations()).map((r) => r.status)).toEqual(["released", "released"]);
    await approval("b".repeat(64)); await expect(claim("b".repeat(64))).resolves.toHaveProperty("ids");
  });
  it("rejects outcome changes by another owner and browser-role access", async () => {
    await approval("a".repeat(64)); const held = await claim("a".repeat(64));
    await expect(finishCreationReservations({ ...held, userId: PERSON }, "known_failure", {}, rpcClient)).rejects.toThrow("creation_outcome_requires_reconciliation");
    expect((await reservations()).map((r) => r.status)).toEqual(["running", "running"]);
    await db.setUser(USER); await db.exec("SET ROLE authenticated;");
    try {
      await expect(db.query("SELECT * FROM twenty_creation_reservations")).rejects.toThrow("permission denied");
      await expect(db.query("SELECT twenty_claim_creation_reservations($1,$2,$3,$4,ARRAY['email:jane@acme.test'])", [ORG, CONNECTION, USER, "a".repeat(64)])).rejects.toThrow("permission denied");
    } finally { await db.exec("RESET ROLE;"); }
  });
});
