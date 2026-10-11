// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../helpers/fake-supabase";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), admin: vi.fn(), require: vi.fn(), execute: vi.fn(), resolveJob: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient, createAdminClient: mocks.admin }));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => "org-1" }));
vi.mock("@/lib/actions/notifications", () => ({ markNotificationRead: vi.fn() }));
vi.mock("@/lib/twenty/connections", () => ({ requireTwentyConnection: mocks.require }));
vi.mock("@/lib/twenty/workflows/queue", () => ({ resolveTwentyWorkflowApproval: mocks.resolveJob }));
vi.mock("@/lib/ai/tools/registry", async (original) => ({ ...await original<typeof import("@/lib/ai/tools/registry")>(), executeRegistryTool: mocks.execute }));

import { listPendingApprovalsAction, resolveApproval } from "@/lib/actions/copilot-approvals";
import { recordPendingApproval } from "@/lib/ai/approvals";

const USER = "11111111-1111-4111-8111-111111111111";
const ROW = "22222222-2222-4222-8222-222222222222";
const CONNECTION = "33333333-3333-4333-8333-333333333333";
const JOB = "44444444-4444-4444-8444-444444444444";
const PERSON = "55555555-5555-4555-8555-555555555555";
let db: FakeSupabase;
const row = () => db.tables.copilot_approvals[0];

beforeEach(() => {
  vi.resetAllMocks();
  db = new FakeSupabase({ copilot_approvals: [{ id: ROW, organization_id: "org-1", user_id: USER, source: "workflow", crm_source: "twenty", connection_id: CONNECTION, connection_revision: 3, workflow_job_id: JOB, task_id: null, conversation_id: null, status: "pending", tool_name: "twenty_qualify_lead", input: { personId: PERSON, data: { leadScore: 80 } }, diff: { kind: "update", recordType: "Twenty person", fields: [{ name: "leadScore", before: 20, after: 80 }] }, created_at: "2026-10-01T00:00:00.000Z" }], notifications: [], twenty_jobs: [{ id: JOB, organization_id: "org-1", owner_id: USER, connection_id: CONNECTION, connection_revision: 3, approval_id: ROW, status: "awaiting_approval" }] });
  const client = Object.assign(db, { auth: { getUser: async () => ({ data: { user: { id: USER } } }) } });
  mocks.createClient.mockResolvedValue(client); mocks.admin.mockReturnValue(client);
  mocks.require.mockResolvedValue({ id: CONNECTION, revision: 3 });
  mocks.execute.mockResolvedValue({ ok: true, data: { id: PERSON } });
  mocks.resolveJob.mockResolvedValue(undefined);
});

describe("workflow approvals", () => {
  it("uses authoritative stored payload and immutable source/connection/job context once", async () => {
    expect((await resolveApproval(ROW, true)).status).toBe("applied");
    expect(await resolveApproval(ROW, true)).toEqual({ status: "invalid" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0]).toEqual(["twenty_qualify_lead", row().input, expect.objectContaining({ ctx: expect.objectContaining({ orgId: "org-1", userId: USER, source: "workflow", crmSource: "twenty", connectionId: CONNECTION, connectionRevision: 3, jobId: JOB }) }), { diff: row().diff }]);
    expect(mocks.resolveJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jobId: JOB, approvalId: ROW, status: "applied" }));
    expect(row().status).toBe("applied");
  });
  it("a concurrent duplicate loses the atomic pending claim", async () => {
    const results = await Promise.all([resolveApproval(ROW, true), resolveApproval(ROW, true)]);
    expect(results.map((r) => r.status).sort()).toEqual(["applied", "invalid"]);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it.each(["role", "revision", "owner", "organization", "conversation"])("blocks changed %s before claiming or executing", async (change) => {
    if (change === "role") mocks.require.mockRejectedValue(new Error("twenty_access_denied"));
    if (change === "revision") mocks.require.mockResolvedValue({ id: CONNECTION, revision: 4 });
    if (change === "owner") row().user_id = PERSON;
    if (change === "organization") row().organization_id = "org-2";
    if (change === "conversation") row().conversation_id = PERSON;
    expect(await resolveApproval(ROW, true)).toEqual({ status: "invalid" });
    expect(row().status).toBe("pending");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("denies without an external write and records the workflow outcome", async () => {
    expect(await resolveApproval(ROW, false)).toEqual({ status: "denied" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.resolveJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "denied", jobId: JOB }));
  });
  it.each(["owner", "connection", "approval", "status"])("rejects a job with changed %s binding", async (field) => {
    const job = db.tables.twenty_jobs[0];
    if (field === "owner") job.owner_id = PERSON;
    if (field === "connection") job.connection_id = PERSON;
    if (field === "approval") job.approval_id = PERSON;
    if (field === "status") job.status = "applied";
    expect(await resolveApproval(ROW, true)).toEqual({ status: "invalid" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(row().status).toBe("pending");
  });
  it.each(["partial", "unknown_outcome"] as const)("preserves %s and prevents replay", async (status) => {
    mocks.execute.mockResolvedValue({ ok: false, error: "network_error", outcome: status, data: { reconciliationRequired: true } });
    expect((await resolveApproval(ROW, true)).status).toBe(status);
    expect(row().status).toBe(status);
    expect(await resolveApproval(ROW, true)).toEqual({ status: "invalid" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.resolveJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status }));
  });
  it("does not expose external approvals after role revocation", async () => {
    expect((await listPendingApprovalsAction()).map((r) => r.id)).toEqual([ROW]);
    mocks.require.mockRejectedValue(new Error("twenty_access_denied"));
    expect(await listPendingApprovalsAction()).toEqual([]);
  });
});

describe("approval creation validation", () => {
  it("rejects incomplete external binding and non-workflow jobs before database access", async () => {
    const args = { orgId: "org-1", userId: USER, conversationId: null, taskId: null, source: "workflow" as const, toolCallId: "call-1", toolName: "twenty_qualify_lead", input: {}, diff: { kind: "create" as const, recordType: "Twenty", fields: [] }, crmSource: "twenty" as const, connectionId: CONNECTION, connectionRevision: 3, workflowJobId: JOB };
    await expect(recordPendingApproval({} as never, args)).rejects.toThrow("Invalid Twenty approval binding");
    await expect(recordPendingApproval({} as never, { ...args, crmSource: "pulse" })).rejects.toThrow("Invalid workflow approval source");
  });
});
