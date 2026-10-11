// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "ai";
import { FakeSupabase } from "../../helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  require: vi.fn(), get: vi.fn(), list: vi.fn(), update: vi.fn(), create: vi.fn(), connectedAccounts: vi.fn(), sendEmail: vi.fn(), reserve: vi.fn(), finish: vi.fn(), admin: vi.fn(),
}));
vi.mock("@/lib/twenty/connections", () => ({ requireTwentyConnection: mocks.require }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/twenty/creation-reservations", () => ({ claimCreationReservations: mocks.reserve, finishCreationReservations: mocks.finish }));
vi.mock("@/lib/twenty/client", () => ({ getTwentyClient: () => ({ get: mocks.get, list: mocks.list, update: mocks.update, create: mocks.create, connectedAccounts: mocks.connectedAccounts, sendEmail: mocks.sendEmail }) }));

import { buildCopilotToolSet, executeRegistryTool, listRegistryTools, proposeRegistryDiff, type CopilotToolEnv } from "@/lib/ai/tools/registry";

const PERSON = "11111111-1111-4111-8111-111111111111";
const COMPANY = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const ACCOUNT = "55555555-5555-4555-8555-555555555555";
const BASELINE = "2026-10-01T12:00:00.000Z";
let db: FakeSupabase;
function env(): CopilotToolEnv { return { db: db as unknown as SupabaseClient, ctx: { orgId: "org-1", userId: USER, isGuest: false, source: "chat", taskId: null, conversationId: "conversation-1", crmSource: "twenty", connectionId: CONNECTION, connectionRevision: 3 } }; }
const tool = (name: string) => listRegistryTools("chat", "twenty").find((t) => t.name === name)!;
async function diff(name: string, input: Record<string, unknown>, environment = env()) { return proposeRegistryDiff(tool(name), input, environment); }
type SdkFn = (...args: unknown[]) => Promise<unknown>;
const execute = (t: Tool) => t.execute as unknown as SdkFn;
const approve = (t: Tool) => t.needsApproval as unknown as SdkFn;
const options = { toolCallId: "call-1", messages: [] };

beforeEach(() => {
  vi.resetAllMocks();
  db = new FakeSupabase({ copilot_artifacts: [], copilot_memory: [] });
  mocks.admin.mockReturnValue(db);
  mocks.require.mockResolvedValue({ id: CONNECTION, revision: 3 });
  mocks.get.mockResolvedValue({ id: PERSON, updatedAt: BASELINE, leadScore: 10, companyId: null });
  mocks.list.mockResolvedValue({ records: [], endCursor: null, hasNextPage: false });
  mocks.update.mockResolvedValue({ id: PERSON, updatedAt: BASELINE });
  mocks.create.mockImplementation(async (object: string) => ({ id: object === "company" ? COMPANY : PERSON, updatedAt: BASELINE }));
  mocks.connectedAccounts.mockResolvedValue([{ id: ACCOUNT, handle: "sender@example.com" }]);
  mocks.sendEmail.mockResolvedValue({ sent: true });
  mocks.reserve.mockImplementation(async (args) => ({ ...args, ids: args.keys.map((_key: string, index: number) => `reservation-${index}`) }));
  mocks.finish.mockResolvedValue(undefined);
});

describe("Twenty source and authorization", () => {
  it("has no Pulse tools, native automation tools, deletes, bulk writes or automatic task creation", () => {
    const names = listRegistryTools("chat", "twenty").map((t) => t.name);
    expect(names).toContain("twenty_qualify_lead");
    expect(names.every((n) => n.startsWith("twenty_"))).toBe(true);
    expect(names).not.toContain("create_task");
    expect(listRegistryTools("chat").map((t) => t.name)).not.toContain("twenty_search");
    expect(names.some((n) => /delete|bulk|app_|workflow/.test(n))).toBe(false);
  });
  it("denies guests and missing or changed connections before any record query", async () => {
    const e = env(); e.ctx.isGuest = true;
    expect(await executeRegistryTool("twenty_search", { object: "person" }, e)).toMatchObject({ ok: false, error: "twenty_access_denied" });
    expect(mocks.list).not.toHaveBeenCalled();
    e.ctx.isGuest = false; mocks.require.mockResolvedValue({ id: CONNECTION, revision: 4 });
    expect(await executeRegistryTool("twenty_search", { object: "person" }, e)).toMatchObject({ ok: false, error: "connection_changed" });
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rechecks owner/admin access on each operation after role revocation", async () => {
    await executeRegistryTool("twenty_search", { object: "person" }, env());
    mocks.require.mockRejectedValue(new Error("twenty_access_denied"));
    expect(await executeRegistryTool("twenty_search", { object: "person" }, env())).toMatchObject({ ok: false, error: "twenty_access_denied" });
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
  it("rejects non-sales object and forbidden patch fields", async () => {
    expect(await executeRegistryTool("twenty_search", { object: "bankAccount" }, env())).toMatchObject({ ok: false });
    expect(await executeRegistryTool("twenty_qualify_lead", { personId: PERSON, data: { emailVerificationStatus: "VALID" } }, env())).toMatchObject({ ok: false, error: expect.stringContaining("invalid_input") });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("immutable approved Twenty writes", () => {
  const input = { personId: PERSON, data: { leadScore: 75, qualificationNotes: "Matches retrieved ICP" } };
  it("requires approval even with an always-allow preference and never executes its own proposal", async () => {
    const proposed = vi.fn(async () => undefined);
    const tools = buildCopilotToolSet(env(), { alwaysAllow: ["twenty_qualify_lead"], onWriteRequested: proposed });
    expect(await approve(tools.twenty_qualify_lead)(input, options)).toBe(true);
    expect(proposed).toHaveBeenCalledOnce();
    expect(await execute(tools.twenty_qualify_lead)(input, options)).toEqual({ ok: false, error: "not_executed" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects direct writes without a stored diff", async () => {
    expect(await executeRegistryTool("twenty_qualify_lead", input, env())).toEqual({ ok: false, error: "approval_required" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("executes an approved conditional update once in a turn with the original timestamp", async () => {
    const approved = await diff("twenty_qualify_lead", input);
    const tools = buildCopilotToolSet(env(), { alwaysAllow: [], onWriteRequested: vi.fn(), resolveDiff: async () => approved });
    expect(await execute(tools.twenty_qualify_lead)(input, options)).toMatchObject({ ok: true });
    expect(await execute(tools.twenty_qualify_lead)(input, options)).toEqual({ ok: false, error: "not_executed" });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("person", PERSON, BASELINE, input.data);
  });
  it.each(["input", "diff", "user", "connection", "source"])("rejects an altered %s without sending a mutation", async (field) => {
    const approved = await diff("twenty_qualify_lead", input);
    const e = env(); let mutationInput = structuredClone(input);
    if (field === "input") mutationInput = { ...input, data: { ...input.data, leadScore: 100 } };
    if (field === "diff") approved.fields[0].after = 100;
    if (field === "user") e.ctx.userId = COMPANY;
    if (field === "connection") e.ctx.connectionId = COMPANY;
    if (field === "source") e.ctx.crmSource = "pulse";
    expect(await executeRegistryTool("twenty_qualify_lead", mutationInput, e, { diff: approved })).toMatchObject({ ok: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns stale on a failed CAS and retains unknown mutation outcomes", async () => {
    const approved = await diff("twenty_qualify_lead", input);
    mocks.update.mockRejectedValue({ code: "record_changed" });
    expect(await executeRegistryTool("twenty_qualify_lead", input, env(), { diff: approved })).toEqual({ ok: false, error: "record_changed" });
    mocks.update.mockRejectedValue({ code: "network_error", outcome: "unknown_outcome" });
    expect(await executeRegistryTool("twenty_qualify_lead", input, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "unknown_outcome" });
  });
  it("updates an opportunity with a reviewed monetary patch and a conditional version", async () => {
    const update = { opportunityId: PERSON, data: { stage: "WON", amount: { amountMicros: 2500000000, currencyCode: "USD" } } };
    const approved = await diff("twenty_update_opportunity", update);
    expect(await executeRegistryTool("twenty_update_opportunity", update, env(), { diff: approved })).toMatchObject({ ok: true });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("opportunity", PERSON, BASELINE, update.data);
  });
  it.each(["twenty_create_note", "twenty_create_task"])("requires a reviewed payload for %s and never schedules AI", async (name) => {
    const create = { title: "Follow up", body: "Reviewed CRM text" };
    expect(await executeRegistryTool(name, create, env())).toEqual({ ok: false, error: "approval_required" });
    const approved = await diff(name, create);
    expect(await executeRegistryTool(name, create, env(), { diff: approved })).toMatchObject({ ok: true });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(name === "twenty_create_task" ? "task" : "note", { title: create.title, bodyV2: { markdown: create.body } });
    expect(db.tables.copilot_tasks).toBeUndefined();
  });
});

describe("reviewed bundles and email", () => {
  const quick = { firstName: "Jane", lastName: "Doe", email: "jane@acme.test", companyName: "Acme", companyDomain: "acme.test" };
  it("matches an imported company URL with a trailing slash without creating a duplicate", async () => {
    mocks.list.mockImplementation(async (object) => ({ records: object === "company" ? [{ id: COMPANY, name: "Acme", updatedAt: BASELINE, domainName: { primaryLinkUrl: "https://www.acme.test/about/" } }] : [] }));
    const proposed = await diff("twenty_quick_lead", quick);
    expect(proposed.fields[1].name).toBe("link company");
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: proposed })).toMatchObject({ ok: true });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith("person", expect.objectContaining({ companyId: COMPANY }));
  });
  it("will not silently miss company candidates beyond the bounded duplicate check", async () => {
    mocks.list.mockImplementation(async (object) => ({ records: [], hasNextPage: object === "company" }));
    await expect(diff("twenty_quick_lead", quick)).rejects.toThrow("company_domain_candidates_require_review");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("binds mailbox readiness to a workflow email and rejects a later changed mailbox", async () => {
    const e = env(); e.ctx.source = "workflow"; e.ctx.conversationId = null; e.ctx.jobId = "job";
    db.tables.twenty_jobs = [{ id: "job", organization_id: "org-1", owner_id: USER, connection_id: CONNECTION, connection_revision: 3, kind: "mailbox_ready", record_id: PERSON, record_version: BASELINE.replace(".000Z", "+00:00") }];
    mocks.get.mockResolvedValue({ id: PERSON, updatedAt: BASELINE, status: "ACTIVE", healthScore: 95, spamPlacementRate: 0.05 });
    const input = { connectedAccountId: ACCOUNT, fromHandle: "sender@example.com", recipients: ["owner@example.com"], subject: "Ready", body: "Reviewed notification" };
    const proposed = await diff("twenty_send_email", input, e);
    expect(proposed.approvalBinding?.preconditions).toMatchObject({ mailboxId: PERSON });
    mocks.get.mockResolvedValue({ id: PERSON, updatedAt: "2026-10-01T12:01:00.000Z", status: "INACTIVE", healthScore: 50, spamPlacementRate: 0.2 });
    expect(await executeRegistryTool("twenty_send_email", input, e, { diff: proposed })).toMatchObject({ ok: false, error: "record_changed" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("requires visible canonical email draft content", async () => {
    expect(await executeRegistryTool("twenty_save_draft", { kind: "opener", title: "Opener", content: { text: "Hidden content" } }, env())).toMatchObject({ ok: false, error: expect.stringContaining("body") });
    expect(await executeRegistryTool("twenty_save_draft", { kind: "opener", title: "Opener", content: { body: "Visible content" } }, env())).toMatchObject({ ok: true });
    expect(db.tables.copilot_artifacts[0].content).toMatchObject({ body: "Visible content" });
  });
  it("creates the displayed company/person bundle with an explicit company ID", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    expect(approved.fields.map((f) => f.name)).toEqual(["person", "create company"]);
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: true, data: { companyId: COMPANY, personId: PERSON } });
    expect(mocks.create.mock.calls[1][1]).toMatchObject({ companyId: COMPANY });
  });
  it("rejects an existing email without proposing another creation", async () => {
    mocks.list.mockImplementation(async (object) => ({ records: object === "person" ? [{ id: PERSON, emails: { primaryEmail: quick.email } }] : [] }));
    await expect(diff("twenty_quick_lead", quick)).rejects.toThrow("duplicate_person_email_requires_review");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains completed IDs after a partial bundle; no automatic replay occurs", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    mocks.create.mockResolvedValueOnce({ id: COMPANY }).mockRejectedValueOnce({ code: "request_rejected" });
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "partial", data: { completed: { companyId: COMPANY }, reconciliationRequired: true } });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("preserves an unknown creation result even when no ID was returned", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    mocks.create.mockRejectedValue({ code: "network_error", outcome: "unknown_outcome" });
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "unknown_outcome", data: { reconciliationRequired: true } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("rechecks authorization between bundle operations", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    mocks.require.mockResolvedValueOnce({ id: CONNECTION, revision: 3 }).mockResolvedValueOnce({ id: CONNECTION, revision: 3 }).mockRejectedValueOnce(new Error("twenty_access_denied"));
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "partial" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("reserves both new domain and email before creating, and blocks a busy creation key", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    mocks.reserve.mockRejectedValue(new Error("creation_reserved_requires_review"));
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, error: "creation_reserved_requires_review" });
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ keys: [`email:${quick.email}`, `domain:${quick.companyDomain}`], approvalHash: approved.approvalBinding!.payloadHash }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps a durable fence when creation or local outcome persistence is uncertain", async () => {
    const approved = await diff("twenty_quick_lead", quick);
    mocks.create.mockRejectedValue({ code: "network_error", outcome: "unknown_outcome" });
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "unknown_outcome", data: { reservationIds: ["reservation-0", "reservation-1"] } });
    expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), "unknown_outcome", {});
    mocks.create.mockImplementation(async (object: string) => ({ id: object === "company" ? COMPANY : PERSON }));
    mocks.finish.mockRejectedValue({ code: "creation_outcome_requires_reconciliation", outcome: "unknown_outcome" });
    expect(await executeRegistryTool("twenty_quick_lead", quick, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "unknown_outcome", data: { completed: { companyId: COMPANY, personId: PERSON } } });
  });
  it("rejects personal email company domains", async () => {
    expect(await executeRegistryTool("twenty_quick_lead", { ...quick, companyDomain: "gmail.com" }, env())).toMatchObject({ ok: false, error: expect.stringContaining("invalid_input") });
  });
  it("binds all sender and email fields and reports unknown send results", async () => {
    const email = { connectedAccountId: ACCOUNT, fromHandle: "sender@example.com", recipients: ["to@example.com"], subject: "Review this", body: "Exact approved body" };
    const approved = await diff("twenty_send_email", email);
    expect(approved.fields).toEqual(expect.arrayContaining([{ name: "body", after: email.body }, { name: "recipients", after: email.recipients }]));
    expect(await executeRegistryTool("twenty_send_email", { ...email, body: "Changed body" }, env(), { diff: approved })).toMatchObject({ ok: false, error: "approval_payload_changed" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    mocks.sendEmail.mockRejectedValue({ code: "network_error", outcome: "unknown_outcome" });
    expect(await executeRegistryTool("twenty_send_email", email, env(), { diff: approved })).toMatchObject({ ok: false, outcome: "unknown_outcome" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
  it("cannot send from an account whose current handle differs", async () => {
    const email = { connectedAccountId: ACCOUNT, fromHandle: "sender@example.com", recipients: ["to@example.com"], subject: "Hi", body: "Hello" };
    const approved = await diff("twenty_send_email", email);
    mocks.connectedAccounts.mockResolvedValue([{ id: ACCOUNT, handle: "different@example.com" }]);
    expect(await executeRegistryTool("twenty_send_email", email, env(), { diff: approved })).toMatchObject({ ok: false, error: "sender_account_mismatch" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("isolated local drafts and memory", () => {
  it("stores source and external record references instead of Pulse record links", async () => {
    await executeRegistryTool("twenty_save_draft", { kind: "proposal", title: "Proposal", content: { body: "Draft" }, record: { object: "person", id: PERSON } }, env());
    expect(db.tables.copilot_artifacts[0]).toMatchObject({ crm_source: "twenty", connection_id: CONNECTION, external_record_ref: { connectionId: CONNECTION, object: "person", id: PERSON }, task_id: null });
    expect(db.tables.copilot_artifacts[0].linked_record_id).toBeUndefined();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("binds remembered facts to this Twenty connection", async () => {
    await executeRegistryTool("twenty_save_memory", { content: "Use short openers" }, env());
    expect(db.tables.copilot_memory[0]).toMatchObject({ crm_source: "twenty", connection_id: CONNECTION, user_id: USER, type: "custom" });
  });
  it("scheduled jobs stage writes and never execute them", async () => {
    const e = env(); e.ctx.source = "workflow"; e.ctx.jobId = COMPANY;
    const record = vi.fn<(_info: unknown) => Promise<{ id: string }>>().mockResolvedValue({ id: "approval-1" });
    const tools = buildCopilotToolSet(e, { alwaysAllow: ["twenty_qualify_lead"], onWriteRequested: record });
    expect(await execute(tools.twenty_qualify_lead)({ personId: PERSON, data: { leadScore: 80 } }, options)).toMatchObject({ status: "proposed", approvalRowId: "approval-1" });
    expect(record.mock.calls[0][0]).toMatchObject({ diff: { approvalBinding: { connectionId: CONNECTION, userId: USER } } });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
