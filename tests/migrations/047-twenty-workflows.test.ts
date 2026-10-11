import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER = "11111111-1111-4111-8111-111111111111";
const CONN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RECORD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let db: TestDb;
type Claimed = { id: string; lease_token: string; attempts: number };
async function workflow(kind = "company_link", enabled = true) {
  const [row] = await db.query<Claimed>("INSERT INTO twenty_workflows(organization_id,connection_id,connection_revision,owner_id,kind,enabled) VALUES($1,$2,1,$3,$4,$5) RETURNING id", [ORG, CONN, OWNER, kind, enabled]);
  return row.id;
}
async function job(workflowId: string | null, kind = "company_link") {
  const [row] = await db.query<Claimed>("INSERT INTO twenty_jobs(organization_id,connection_id,connection_revision,workflow_id,owner_id,kind,payload,dedupe_key) VALUES($1,$2,1,$3,$4,$5,'{}',gen_random_uuid()::text) RETURNING id", [ORG, CONN, workflowId, OWNER, kind]);
  return row.id;
}
async function claimJob() { return (await db.query<Claimed>("SELECT * FROM claim_twenty_jobs(1)"))[0]; }
async function observe(w: Claimed, version: string, ready: boolean | null, baseline = false) {
  return (await db.query<{ value: boolean }>("SELECT twenty_observe_record($1,$2,$3,$4,$5,$6,$7) AS value", [ORG, w.id, w.lease_token, RECORD, version, ready, baseline]))[0].value;
}
beforeAll(async () => {
  db = await createTestDb();
  await db.exec("ALTER TABLE auth.users ADD COLUMN is_anonymous boolean DEFAULT false; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;");
  for (const migration of ["042_copilot_v2_history_approvals.sql", "043_copilot_v2_artifacts_memory_notifications.sql", "045_twenty_connections.sql", "046_copilot_twenty_sources.sql", "047_twenty_workflows.sql"]) await db.applyMigration(migration);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${OWNER}','owner@example.test');
    INSERT INTO organizations(id,name,slug) VALUES('${ORG}','A','a'),('${OTHER}','B','b');
    INSERT INTO profiles(id,organization_id,email,role) VALUES('${OWNER}','${ORG}','owner@example.test','owner');
    INSERT INTO twenty_connections(id,organization_id,owner_id,workspace_url,workspace_id,cas_verified) VALUES('${CONN}','${ORG}','${OWNER}','https://orbix-sales.twenty.com','${CONN}',true);`);
}, 30_000);
beforeEach(async () => {
  await db.exec(`TRUNCATE twenty_workflows,twenty_jobs,twenty_workflow_runs,twenty_mailbox_states,twenty_token_usage,twenty_token_reservations,copilot_approvals CASCADE;
    UPDATE profiles SET role='owner'; UPDATE auth.users SET is_anonymous=false;
    UPDATE twenty_connections SET revision=1,status='verified',monthly_token_cap=NULL;`);
});
afterAll(async () => { await db?.close(); });

describe("Twenty durable queue SQL", () => {
  it("starts workflows disabled and denies browser access to queue tables and functions", async () => {
    await workflow("qualification", false);
    expect(await db.query("SELECT * FROM claim_twenty_workflows(10)")).toHaveLength(0);
    await db.exec("SET ROLE authenticated");
    try {
      await expect(db.query("SELECT * FROM twenty_jobs")).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT * FROM claim_twenty_jobs(1)")).rejects.toThrow(/permission denied/);
    } finally { await db.exec("RESET ROLE"); }
  });
  it("rejects cross-tenant connection references even for server inserts", async () => {
    await expect(db.query("INSERT INTO twenty_workflows(organization_id,connection_id,connection_revision,owner_id,kind) VALUES($1,$2,1,$3,'qualification')", [OTHER, CONN, OWNER])).rejects.toThrow(/foreign key/);
  });
  it("claims each job once and replaces the fence only after expiry", async () => {
    await job(await workflow());
    const claimed = await claimJob();
    expect(await db.query("SELECT * FROM claim_twenty_jobs(1)")).toHaveLength(0);
    await db.query("UPDATE twenty_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [claimed.id]);
    const replacement = await claimJob();
    expect(replacement.lease_token).not.toBe(claimed.lease_token);
    expect(replacement.attempts).toBe(2);
    await expect(db.query("SELECT twenty_stage_job_approval($1,$2,$3,'twenty_link_company','{}','{}')", [ORG, claimed.id, claimed.lease_token])).rejects.toThrow(/job_lease_lost/);
  });
  it("atomically stages exactly one approval and never reclaims awaiting jobs", async () => {
    await job(await workflow()); const claimed = await claimJob();
    const [result] = await db.query<{ id: string }>(`SELECT twenty_stage_job_approval($1,$2,$3,'twenty_link_company','{"personId":"x"}','{"kind":"update"}') AS id`, [ORG, claimed.id, claimed.lease_token]);
    const [stored] = await db.query<{ status: string; approval_id: string }>("SELECT status,approval_id FROM twenty_jobs WHERE id=$1", [claimed.id]);
    expect(stored).toEqual({ status: "awaiting_approval", approval_id: result.id });
    expect(await db.query("SELECT * FROM claim_twenty_jobs(1)")).toHaveLength(0);
    await expect(db.query("SELECT twenty_stage_job_approval($1,$2,$3,'twenty_link_company','{}','{}')", [ORG, claimed.id, claimed.lease_token])).rejects.toThrow(/job_lease_lost/);
    expect(await db.query("SELECT * FROM copilot_approvals")).toHaveLength(1);
  });
  it.each(["role", "anonymous", "connection", "workflow"])("rechecks %s immediately before staging an approval", async (change) => {
    const w = await workflow(); await job(w); const claimed = await claimJob();
    if (change === "role") await db.exec("UPDATE profiles SET role='member'");
    if (change === "anonymous") await db.exec("UPDATE auth.users SET is_anonymous=true");
    if (change === "connection") await db.exec("UPDATE twenty_connections SET revision=2");
    if (change === "workflow") await db.exec("UPDATE twenty_workflows SET enabled=false");
    await expect(db.query("SELECT twenty_stage_job_approval($1,$2,$3,'twenty_link_company','{}','{}')", [ORG, claimed.id, claimed.lease_token])).rejects.toThrow();
    expect(await db.query("SELECT * FROM copilot_approvals")).toHaveLength(0);
  });
  it("requires a job-backed workflow approval", async () => {
    await expect(db.query("INSERT INTO copilot_approvals(organization_id,user_id,source,crm_source,connection_id,connection_revision,tool_call_id,tool_name,input,diff) VALUES($1,$2,'workflow','twenty',$3,1,'forged','twenty_link_company','{}','{}')", [ORG, OWNER, CONN])).rejects.toThrow(/twenty_workflow_approval_job/);
  });
  it("deduplicates inclusive timestamp replay and rejects an expired polling fence", async () => {
    await workflow(); const [claimed] = await db.query<Claimed>("SELECT * FROM claim_twenty_workflows(1)");
    expect(await observe(claimed, "2026-10-11T10:00:00Z", null)).toBe(true);
    expect(await observe(claimed, "2026-10-11T10:00:00Z", null)).toBe(false);
    expect(await db.query("SELECT * FROM twenty_jobs")).toHaveLength(1);
    await db.exec("UPDATE twenty_workflows SET lease_until=now()-interval '1 second'");
    await expect(observe(claimed, "2026-10-11T10:00:01Z", null)).rejects.toThrow(/poll_lease_lost/);
  });
  it("baselines mailbox state without notifications, then only enqueues readiness transitions", async () => {
    await workflow("mailbox_ready"); const [claimed] = await db.query<Claimed>("SELECT * FROM claim_twenty_workflows(1)");
    expect(await observe(claimed, "2026-10-11T10:00:00Z", true, true)).toBe(false);
    expect(await observe(claimed, "2026-10-11T10:00:01Z", true)).toBe(false);
    expect(await observe(claimed, "2026-10-11T10:00:02Z", false)).toBe(false);
    expect(await observe(claimed, "2026-10-11T10:00:03Z", true)).toBe(true);
    expect(await observe(claimed, "2026-10-11T10:00:03Z", true)).toBe(false);
    expect(await observe(claimed, "2026-10-11T10:00:01Z", false)).toBe(false);
    expect(await db.query("SELECT * FROM twenty_jobs")).toHaveLength(1);
  });
  it("requires a configured cap, active workflow and current owner before any AI reservation", async () => {
    await job(await workflow("qualification"), "qualification"); const claimed = await claimJob();
    await expect(db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, claimed.id, claimed.lease_token])).rejects.toThrow(/scheduled_ai_disabled/);
    await db.exec("UPDATE twenty_connections SET monthly_token_cap=5000; UPDATE profiles SET role='member'");
    await expect(db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, claimed.id, claimed.lease_token])).rejects.toThrow(/owner_changed/);
  });
  it("serializes reservations, enforces the cap and settles successful usage once", async () => {
    const w = await workflow("qualification"); await job(w, "qualification"); await job(w, "qualification");
    await db.exec("UPDATE twenty_connections SET monthly_token_cap=1500");
    const first = await claimJob();
    const [reservation] = await db.query<{ id: string }>("SELECT reserve_twenty_tokens($1,$2,$3,1000) AS id", [ORG, first.id, first.lease_token]);
    const second = await claimJob();
    await expect(db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, second.id, second.lease_token])).rejects.toThrow(/monthly_token_cap_exceeded/);
    await db.query("SELECT settle_twenty_tokens($1,$2,$3,200)", [ORG, first.id, reservation.id]);
    await db.query("SELECT settle_twenty_tokens($1,$2,$3,0)", [ORG, first.id, reservation.id]);
    expect((await db.query<{ used: number }>("SELECT used FROM twenty_token_usage"))[0].used).toBe(200);
    await db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, second.id, second.lease_token]);
    await expect(db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, second.id, second.lease_token])).rejects.toThrow(/already_reserved/);
  });
  it("keeps uncertain AI charged and marks expired metered jobs unknown instead of replaying", async () => {
    await job(await workflow("qualification"), "qualification"); await db.exec("UPDATE twenty_connections SET monthly_token_cap=5000");
    const claimed = await claimJob();
    await db.query("SELECT reserve_twenty_tokens($1,$2,$3,1000)", [ORG, claimed.id, claimed.lease_token]);
    await db.exec("UPDATE twenty_jobs SET lease_until=now()-interval '1 second'");
    expect(await db.query("SELECT * FROM claim_twenty_jobs(1)")).toHaveLength(0);
    expect((await db.query<{ status: string }>("SELECT status FROM twenty_jobs"))[0].status).toBe("unknown_outcome");
    expect((await db.query<{ used: number }>("SELECT used FROM twenty_token_usage"))[0].used).toBe(1000);
    expect((await db.query<{ event: string }>("SELECT event FROM twenty_workflow_runs"))[0].event).toBe("unknown_outcome");
  });
  it("terminates exhausted non-AI retries", async () => {
    await job(await workflow()); const claimed = await claimJob();
    await db.query("UPDATE twenty_jobs SET attempts=5,lease_until=now()-interval '1 second' WHERE id=$1", [claimed.id]);
    expect(await db.query("SELECT * FROM claim_twenty_jobs(1)")).toHaveLength(0);
    expect((await db.query<{ status: string }>("SELECT status FROM twenty_jobs"))[0].status).toBe("failed");
  });
});
