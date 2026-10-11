import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TwentyJob } from "@/lib/twenty/workflows/types";
import { TwentyGPTResponseError } from "@/lib/twenty/gpt-client";
const mocks = vi.hoisted(() => ({ connection: vi.fn(), get: vi.fn(), list: vi.fn(), resolve: vi.fn(), catalog: vi.fn(), inference: vi.fn(), diff: vi.fn() }));
vi.mock("@/lib/twenty/connections", () => ({ requireTwentyConnection: mocks.connection }));
vi.mock("@/lib/twenty/client", () => ({ getTwentyClient: () => ({ get: mocks.get, list: mocks.list }) }));
vi.mock("@/lib/twenty/relay", () => ({ resolveTwentyRelay: mocks.resolve, validateTwentyRelayModels: mocks.catalog, createTwentyMessagesClient: () => ({ messages: { create: mocks.inference } }) }));
vi.mock("@/lib/ai/tools/registry", () => ({ listRegistryTools: () => ["twenty_quick_lead", "twenty_link_company", "twenty_send_email", "twenty_qualify_lead"].map((name) => ({ name, kind: "write", inputSchema: { parse: (input: unknown) => input } })), proposeRegistryDiff: mocks.diff }));
import { processTwentyJob } from "@/lib/twenty/workflows/worker";

const VERSION = "2026-10-11T10:00:00.000Z";
const base: TwentyJob = { id: "job", organization_id: "org", connection_id: "conn", connection_revision: 1, workflow_id: "workflow", owner_id: "owner", kind: "company_link", record_id: "person", record_version: VERSION, payload: {}, status: "running", attempts: 1, lease_token: "lease", lease_until: "2026-10-11T11:00:00Z", approval_id: null };
function database(kind: string = "company_link") {
  const updates: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (name: string) => ({ data: name === "reserve_twenty_tokens" ? "reservation" : "approval", error: null }));
  const workflow = { ...base, enabled: true, kind, config: { connectedAccountId: "sender-id", fromHandle: "owner@example.com", recipients: ["owner@example.com"] } };
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["eq", "gt", "is", "order"]) chain[method] = vi.fn(() => chain);
    chain.select = vi.fn(() => table === "twenty_jobs" ? Promise.resolve({ data: [{ id: "job" }], error: null }) : chain);
    chain.maybeSingle = vi.fn(async () => ({ data: table === "twenty_workflows" ? workflow : {}, error: null }));
    chain.update = vi.fn((input) => { updates.push(input); return chain; });
    chain.insert = vi.fn(async () => ({ error: null }));
    return chain;
  });
  return { db: { from, rpc }, updates, rpc, workflow };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.mockResolvedValue({ id: "conn", revision: 1, monthly_token_cap: 50000 });
  mocks.get.mockResolvedValue({ id: "person", updatedAt: VERSION, createdBy: { source: "API" }, emails: { primaryEmail: "lead@business.com" } });
  mocks.list.mockResolvedValue({ records: [], hasNextPage: false });
  mocks.resolve.mockReturnValue({ fastModel: "fast", model: "main" });
  mocks.catalog.mockResolvedValue(["fast", "main"]);
  mocks.diff.mockResolvedValue({ kind: "update", recordType: "Twenty person", fields: [], baselineUpdatedAt: VERSION });
  mocks.inference.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ leadScore: 70, aiSummary: "Evidence-based summary", qualificationNotes: "Limited information" }) }], usage: { input_tokens: 100, output_tokens: 100 }, stop_reason: "end_turn" });
});

describe("Twenty workflow preparation", () => {
  it("accepts equivalent PostgreSQL and GraphQL timestamp formatting", async () => {
    const { db, rpc } = database();
    await processTwentyJob(db as never, { ...base, record_version: "2026-10-11T10:00:00+00:00" });
    expect(rpc).toHaveBeenCalledWith("twenty_stage_job_approval", expect.anything());
  });
  it("prepares the Quick Lead bundle without mutating Twenty or calling AI", async () => {
    const { db, rpc } = database();
    const payload = { firstName: "A", lastName: "", email: "a@business.com" };
    await processTwentyJob(db as never, { ...base, kind: "quick_lead", workflow_id: null, payload });
    expect(rpc).toHaveBeenCalledWith("twenty_stage_job_approval", expect.objectContaining({ p_tool: "twenty_quick_lead", p_input: payload }));
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.inference).not.toHaveBeenCalled();
  });
  it("proposes business-domain matching and company linking", async () => {
    const { db, rpc } = database(); await processTwentyJob(db as never, base);
    expect(rpc).toHaveBeenCalledWith("twenty_stage_job_approval", expect.objectContaining({ p_tool: "twenty_link_company", p_input: { personId: "person", companyName: "business.com", companyDomain: "business.com" } }));
    expect(mocks.inference).not.toHaveBeenCalled();
  });
  it.each([
    { emails: { primaryEmail: "lead@gmail.com" } }, { companyId: "already-linked" }, { updatedBy: { source: "EMAIL" } }, { createdBy: { source: "CALENDAR" } },
  ])("skips a company-link record excluded by the original behavior: %j", async (change) => {
    mocks.get.mockResolvedValue({ id: "person", updatedAt: VERSION, createdBy: { source: "API" }, emails: { primaryEmail: "lead@business.com" }, ...change });
    const { db, rpc, updates } = database(); await processTwentyJob(db as never, base);
    expect(updates[0].status).toBe("skipped"); expect(rpc).not.toHaveBeenCalled();
  });
  it("fails closed when system-source exclusions cannot be verified", async () => {
    mocks.get.mockResolvedValue({ id: "person", updatedAt: VERSION, emails: { primaryEmail: "lead@business.com" } });
    const { db, updates } = database(); await processTwentyJob(db as never, base);
    expect(updates[0]).toMatchObject({ status: "failed", result: { error: "system_source_fields_unsupported" } });
  });
  it("creates a complete sender/recipient/body approval for mailbox readiness", async () => {
    mocks.get.mockResolvedValue({ id: "mailbox", updatedAt: VERSION, email: "sales@business.com", status: "ACTIVE", healthScore: 95, spamPlacementRate: 0.05 });
    const { db, rpc } = database("mailbox_ready"); await processTwentyJob(db as never, { ...base, kind: "mailbox_ready", record_id: "mailbox" });
    expect(rpc).toHaveBeenCalledWith("twenty_stage_job_approval", expect.objectContaining({ p_tool: "twenty_send_email", p_input: expect.objectContaining({ connectedAccountId: "sender-id", fromHandle: "owner@example.com", recipients: ["owner@example.com"], subject: "Mailbox ready for outreach", body: expect.stringContaining("sales@business.com") }) }));
    expect(mocks.inference).not.toHaveBeenCalled();
  });
  it("requires the unchanged queued record version", async () => {
    mocks.get.mockResolvedValue({ id: "person", updatedAt: "2026-10-11T10:01:00Z" });
    const { db, rpc, updates } = database(); await processTwentyJob(db as never, base);
    expect(updates[0].status).toBe("stale"); expect(rpc).not.toHaveBeenCalled();
  });
  it("reserves tokens before one inference and stages its bounded qualification patch", async () => {
    const { db, rpc } = database("qualification"); await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(rpc.mock.calls[0][0]).toBe("reserve_twenty_tokens");
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.inference.mock.invocationCallOrder[0]);
    expect(mocks.inference).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("settle_twenty_tokens", expect.objectContaining({ p_actual: 200 }));
    expect(rpc).toHaveBeenCalledWith("twenty_stage_job_approval", expect.objectContaining({ p_tool: "twenty_qualify_lead", p_input: expect.objectContaining({ personId: "person", data: expect.objectContaining({ leadScore: 70 }) }) }));
  });
  it("refuses inference when the monthly cap cannot be reserved", async () => {
    const { db, rpc, updates } = database("qualification"); rpc.mockResolvedValue({ data: null as never, error: { message: "cap exceeded" } as never });
    await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(mocks.inference).not.toHaveBeenCalled(); expect(updates[0].status).toBe("queued");
  });
  it("preserves an uncertain metered outcome without retrying inference", async () => {
    mocks.inference.mockRejectedValue(new Error("timeout"));
    const { db, rpc, updates } = database("qualification"); await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(updates[0].status).toBe("unknown_outcome"); expect(mocks.inference).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith("settle_twenty_tokens", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("twenty_stage_job_approval", expect.anything());
  });
  it.each([{ input_tokens: 100, output_tokens: 50 }, null])("rejects malformed GPT output and settles only trustworthy usage: %j", async (usage) => {
    mocks.inference.mockRejectedValue(new TwentyGPTResponseError(usage));
    const { db, rpc, updates } = database("qualification");
    await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(updates[0].status).toBe("unknown_outcome");
    expect(mocks.inference).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith("twenty_stage_job_approval", expect.anything());
    if (usage) expect(rpc).toHaveBeenCalledWith("settle_twenty_tokens", expect.objectContaining({ p_actual: 150 }));
    else expect(rpc).not.toHaveBeenCalledWith("settle_twenty_tokens", expect.anything());
  });
  it("rejects analysis when the record changes while inference runs", async () => {
    mocks.diff.mockResolvedValue({ kind: "update", recordType: "Twenty person", fields: [], baselineUpdatedAt: "2026-10-11T10:01:00.000Z" });
    const { db, rpc, updates } = database("qualification");
    await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(updates[0]).toMatchObject({ status: "stale", result: { error: "record_changed" } });
    expect(mocks.inference).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith("twenty_stage_job_approval", expect.anything());
  });
  it("does not write a malformed or incomplete model response", async () => {
    mocks.inference.mockResolvedValue({ content: [{ type: "text", text: "not JSON" }], usage: { input_tokens: 100, output_tokens: 100 }, stop_reason: "end_turn" });
    const { db, rpc, updates } = database("qualification"); await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(updates[0].status).toBe("unknown_outcome"); expect(rpc).not.toHaveBeenCalledWith("twenty_stage_job_approval", expect.anything());
  });
  it("honors role revocation and workflow pause before any AI call", async () => {
    mocks.connection.mockRejectedValue(new Error("forbidden"));
    const { db, rpc } = database("qualification"); await processTwentyJob(db as never, { ...base, kind: "qualification" });
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.inference).not.toHaveBeenCalled();
  });
});
