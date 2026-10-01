// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool, ToolSet } from "ai";
import { FakeSupabase } from "../../helpers/fake-supabase";

const fakes = vi.hoisted(() => ({
  saveArtifact: vi.fn(async () => ({ artifactId: "artifact-1" })),
  createTask: vi.fn(async () => ({ taskId: "task-1" })),
  evaluate: vi.fn(async () => ({ skipped: ["enroll_sequence"] })),
}));

vi.mock("@/lib/automation/runner", () => ({ evaluateLeadAgainstRules: fakes.evaluate }));
// T7's copilot-only tools, stood in so mode filtering and low-risk execution are observable.
vi.mock("@/lib/ai/tools/copilot-tools", async () => {
  const { z } = await import("zod");
  return {
    copilotOnlyTools: [
      { name: "save_artifact", description: "Save an artifact", inputSchema: z.object({ title: z.string() }), kind: "low_risk_write", execute: fakes.saveArtifact },
      { name: "create_task", description: "Create a scheduled task", inputSchema: z.object({ title: z.string() }), kind: "write", execute: fakes.createTask },
    ],
  };
});

import {
  buildCopilotToolSet,
  executeRegistryTool,
  listRegistryTools,
  pendingDescriptors,
  type CopilotToolEnv,
} from "@/lib/ai/tools/registry";
import { COPILOT_READ_TOOLS, COPILOT_WRITE_TOOLS, FANOUT_LIMIT_RESULT, NEVER_AUTO_ALLOW } from "@/lib/ai/tools/policy";
import type { FieldDiff } from "@/lib/ai/tools/diff";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const LEAD = "44444444-4444-4444-8444-444444444444";
const BASELINE = "2026-09-01T10:00:00.000Z";

let db: FakeSupabase;

function seed() {
  return new FakeSupabase({
    leads: [
      { id: LEAD, organization_id: ORG, name: "Jane Doe", email: "jane@acme.test", status: "hot", converted_at: null, updated_at: BASELINE },
    ],
    profiles: [{ id: USER, first_name: "John", last_name: "Harris", email: "john@example.com" }],
  });
}

function envFor(source: "chat" | "task", client: unknown = db): CopilotToolEnv {
  return {
    db: client as SupabaseClient,
    ctx: { orgId: ORG, userId: USER, isGuest: false, source, conversationId: source === "chat" ? "conv-1" : null, taskId: source === "task" ? "task-1" : null },
  };
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const callOpts = (toolCallId: string) => ({ toolCallId, messages: [] });
function needsApproval(t: Tool) { return t.needsApproval as unknown as Fn; }
function execute(t: Tool) { return t.execute as unknown as Fn; }
const lead = () => db.tables.leads.find((l) => l.id === LEAD)!;
const leadUpdates = () => db.log.filter((e) => e.table === "leads" && e.op === "update").length;

beforeEach(() => { db = seed(); });
afterEach(() => { vi.clearAllMocks(); pendingDescriptors.clear(); });

describe("listRegistryTools", () => {
  it("chat mode carries the allowlisted MCP tools and never delete_record or any NEVER_AUTO_ALLOW name", () => {
    const names = listRegistryTools("chat").map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([...COPILOT_READ_TOOLS, ...COPILOT_WRITE_TOOLS, "save_artifact", "create_task"]));
    expect(names).not.toContain("delete_record");
    for (const banned of NEVER_AUTO_ALLOW) expect(names).not.toContain(banned);
    expect(names.filter((n) => /^bulk_|_many$/.test(n))).toEqual([]);
  });

  it("task mode contains no create_task but keeps record writes and low-risk saves", () => {
    const names = listRegistryTools("task").map((t) => t.name);
    expect(names).not.toContain("create_task");
    expect(names).toEqual(expect.arrayContaining(["update_lead", "save_artifact", "search_leads"]));
  });

  it("gives every record write a toPatch and a record type", () => {
    for (const t of listRegistryTools("chat").filter((t) => COPILOT_WRITE_TOOLS.includes(t.name))) {
      expect(t.kind, t.name).toBe("write");
      expect(typeof t.toPatch, t.name).toBe("function");
      expect(t.recordType, t.name).toBeTruthy();
    }
  });
});

describe("buildCopilotToolSet (chat)", () => {
  const build = (alwaysAllow: string[] = [], onWriteRequested = vi.fn(async () => undefined)) =>
    ({ tools: buildCopilotToolSet(envFor("chat"), { alwaysAllow, onWriteRequested }), onWriteRequested });

  it("every write tool has needsApproval and every read or low-risk tool lacks it", () => {
    const { tools } = build();
    const kinds = new Map(listRegistryTools("chat").map((t) => [t.name, t.kind]));
    expect(Object.keys(tools).sort()).toEqual([...kinds.keys()].sort());
    for (const [name, tool] of Object.entries(tools as ToolSet)) {
      if (kinds.get(name) === "write") expect(typeof tool.needsApproval, name).toBe("function");
      else expect(tool.needsApproval, name).toBeUndefined();
    }
  });

  it("needsApproval records a pending approval with the diff of the column patch", async () => {
    const { tools, onWriteRequested } = build();
    const input = { id: LEAD, status: "cold", name: "Jane Doe" };
    await expect(needsApproval(tools.update_lead)(input, callOpts("call-1"))).resolves.toBe(true);
    const diff: FieldDiff = {
      kind: "update",
      recordType: "lead",
      recordId: LEAD,
      baselineUpdatedAt: BASELINE,
      fields: [{ name: "status", before: "hot", after: "cold" }],
    };
    expect(onWriteRequested).toHaveBeenCalledWith({ toolCallId: "call-1", toolName: "update_lead", input, diff });
    expect(pendingDescriptors.get("call-1")).toEqual(diff);
  });

  it("an always-allowed write skips approval; delete_record is never in the set", async () => {
    const { tools, onWriteRequested } = build(["update_lead", "delete_record"]);
    await expect(needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("c"))).resolves.toBe(false);
    expect(onWriteRequested).not.toHaveBeenCalled();
    expect(tools.delete_record).toBeUndefined();
  });

  it("the 21st write proposal in one toolset instance yields a fanout_limit result, no throw, no handler call", async () => {
    const { tools, onWriteRequested } = build();
    for (let i = 0; i < 20; i++) {
      await expect(needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts(`call-${i}`))).resolves.toBe(true);
    }
    // 21st: a copilot-only write whose handler is a spy.
    await expect(needsApproval(tools.create_task)({ title: "One too many" }, callOpts("call-20"))).resolves.toBe(false);
    expect(pendingDescriptors.has("call-20")).toBe(false);
    const result = await execute(tools.create_task)({ title: "One too many" }, callOpts("call-20"));
    expect(result).toEqual(FANOUT_LIMIT_RESULT);
    expect(result).toMatchObject({ ok: false, error: "fanout_limit" });
    expect(fakes.createTask).not.toHaveBeenCalled();
    expect(onWriteRequested).toHaveBeenCalledTimes(20);
  });

  it("a shared fanout counter spans toolset instances of one turn and an over-limit record write writes nothing", async () => {
    const fanout = { count: 19 };
    const onWriteRequested = vi.fn(async () => undefined);
    const tools = buildCopilotToolSet(envFor("chat"), { alwaysAllow: [], onWriteRequested, fanout });
    await needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("a"));
    await expect(needsApproval(tools.update_lead)({ id: LEAD, status: "warm" }, callOpts("b"))).resolves.toBe(false);
    expect(pendingDescriptors.has("b")).toBe(false);
    expect(await execute(tools.update_lead)({ id: LEAD, status: "warm" }, callOpts("b"))).toEqual(FANOUT_LIMIT_RESULT);
    expect(lead().status).toBe("hot");
    expect(leadUpdates()).toBe(0);
    expect(fakes.evaluate).not.toHaveBeenCalled();
    expect(onWriteRequested).toHaveBeenCalledTimes(1);
  });

  it("an approved write executes once the live record still matches", async () => {
    const { tools } = build();
    await needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("ok-1"));
    const result = await execute(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("ok-1"));
    expect(result).toMatchObject({ ok: true, automationsSkipped: ["enroll_sequence"] });
    expect(lead().status).toBe("cold");
  });

  it("stale live record returns record_changed without calling the handler", async () => {
    const { tools } = build();
    await needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("stale-1"));
    Object.assign(lead(), { status: "warm", updated_at: "2026-09-02T00:00:00.000Z" });
    const result = await execute(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("stale-1"));
    expect(result).toEqual({ ok: false, error: "record_changed" });
    expect(lead().status).toBe("warm");
    expect(leadUpdates()).toBe(0);
    expect(fakes.evaluate).not.toHaveBeenCalled();
  });

  it("uses resolveDiff for an approval made in an earlier request", async () => {
    const diff: FieldDiff = { kind: "update", recordType: "lead", recordId: LEAD, baselineUpdatedAt: BASELINE, fields: [{ name: "status", before: "warm", after: "cold" }] };
    const tools = buildCopilotToolSet(envFor("chat"), { alwaysAllow: [], onWriteRequested: async () => undefined, resolveDiff: async () => diff });
    const result = await execute(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("from-row"));
    expect(result).toEqual({ ok: false, error: "record_changed" });
    expect(lead().status).toBe("hot");
  });

  it("re-running needsApproval for an approved call keeps the approved diff: no recompute, no new pending row, no fan-out", async () => {
    const approved: FieldDiff = { kind: "update", recordType: "lead", recordId: LEAD, baselineUpdatedAt: BASELINE, fields: [{ name: "status", before: "hot", after: "cold" }] };
    const onWriteRequested = vi.fn(async () => undefined);
    const fanout = { count: 0 };
    const tools = buildCopilotToolSet(envFor("chat"), {
      alwaysAllow: [],
      onWriteRequested,
      fanout,
      resolveDiff: async (id) => (id === "approved-1" ? approved : null),
    });
    // The row moved after the proposal; a recompute would take the new baseline.
    Object.assign(lead(), { status: "warm", updated_at: "2026-09-02T00:00:00.000Z" });
    const reads = db.log.filter((e) => e.table === "leads").length;

    await expect(needsApproval(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("approved-1"))).resolves.toBe(true);
    expect(onWriteRequested).not.toHaveBeenCalled();
    expect(fanout.count).toBe(0);
    expect(pendingDescriptors.has("approved-1")).toBe(false);
    expect(db.log.filter((e) => e.table === "leads").length).toBe(reads);

    const result = await execute(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("approved-1"));
    expect(result).toEqual({ ok: false, error: "record_changed" });
    expect(lead().status).toBe("warm");
    expect(leadUpdates()).toBe(0);
  });

  it("low-risk writes execute directly", async () => {
    const { tools } = build();
    const result = await execute(tools.save_artifact)({ title: "Weekly report" }, callOpts("s"));
    expect(result).toEqual({ ok: true, data: { artifactId: "artifact-1" } });
    expect(fakes.saveArtifact).toHaveBeenCalledWith({ title: "Weekly report" }, expect.objectContaining({ ctx: expect.objectContaining({ orgId: ORG }) }));
  });
});

describe("buildCopilotToolSet (task)", () => {
  it("task mode returns queued without calling the handler", async () => {
    const onWriteRequested = vi.fn(async () => ({ id: "approval-row-1" }));
    const tools = buildCopilotToolSet(envFor("task"), { alwaysAllow: ["update_lead"], onWriteRequested });
    expect(tools.create_task).toBeUndefined();
    expect(tools.update_lead.needsApproval).toBe(false);

    const result = await execute(tools.update_lead)({ id: LEAD, status: "cold" }, callOpts("task-call-1"));
    expect(result).toEqual({ status: "proposed", queued: true, approvalRowId: "approval-row-1" });
    expect(onWriteRequested).toHaveBeenCalledWith(
      expect.objectContaining({ toolCallId: "task-call-1", toolName: "update_lead", diff: expect.objectContaining({ kind: "update" }) }),
    );
    expect(lead().status).toBe("hot");
    expect(leadUpdates()).toBe(0);
    expect(fakes.evaluate).not.toHaveBeenCalled();
  });

  it("low-risk saves still execute in task mode", async () => {
    const tools = buildCopilotToolSet(envFor("task"), { alwaysAllow: [], onWriteRequested: async () => undefined });
    await execute(tools.save_artifact)({ title: "Run output" }, callOpts("t"));
    expect(fakes.saveArtifact).toHaveBeenCalledTimes(1);
  });
});

describe("executeRegistryTool", () => {
  it("fires automations with origin copilot for copilot lead writes and reports skipped actions", async () => {
    const created = await executeRegistryTool("create_lead", { name: "New Lead", email: "new@acme.test" }, envFor("chat"));
    expect(created).toMatchObject({ ok: true, automationsSkipped: ["enroll_sequence"] });
    const newId = (created as { data: { created: { id: string } } }).data.created.id;
    expect(fakes.evaluate).toHaveBeenCalledWith(newId, "lead_created", {}, { origin: "copilot" });

    await executeRegistryTool("update_lead", { id: LEAD, status: "warm" }, envFor("chat"));
    expect(fakes.evaluate).toHaveBeenCalledWith(LEAD, "lead_updated", { changed_fields: ["status"] }, { origin: "copilot" });
    expect(db.tables.leads.find((l) => l.id === newId)).toMatchObject({ organization_id: ORG, created_by: USER });
  });

  it("applies an approved update only while updated_at equals the diff baseline", async () => {
    // Only updated_at moved, so the field diff itself is not stale: the write precondition catches it.
    lead().updated_at = "2026-09-03T00:00:00.000Z";
    const diff: FieldDiff = { kind: "update", recordType: "lead", recordId: LEAD, baselineUpdatedAt: BASELINE, fields: [{ name: "status", before: "hot", after: "cold" }] };
    const result = await executeRegistryTool("update_lead", { id: LEAD, status: "cold" }, envFor("chat"), { diff });
    expect(result).toEqual({ ok: false, error: "record_changed" });
    expect(lead().status).toBe("hot");
  });

  it("validates input, rejects unknown tools and cannot reach delete_record", async () => {
    expect(await executeRegistryTool("update_lead", { id: "not-a-uuid" }, envFor("chat"))).toMatchObject({ ok: false, error: expect.stringMatching(/^invalid_input/) });
    expect(await executeRegistryTool("delete_record", { record_type: "lead", id: LEAD }, envFor("chat"))).toEqual({ ok: false, error: "unknown_tool: delete_record" });
    expect(db.tables.leads).toHaveLength(1);
  });

  it("does not touch another workspace's records", async () => {
    db.tables.leads.push({ id: "55555555-5555-4555-8555-555555555555", organization_id: OTHER_ORG, name: "Other", status: "hot" });
    const result = await executeRegistryTool("update_lead", { id: "55555555-5555-4555-8555-555555555555", status: "cold" }, envFor("chat"));
    expect(result).toEqual({ ok: false, error: "Lead not found" });
    expect(db.tables.leads[1].status).toBe("hot");
  });
});

// ── Org scoping of every exposed MCP handler ────────────────────────────────

type Chain = { tool: string; table: string; op: string; eqs: [string, unknown][]; payload: unknown };

/** Fake supabase that records every .from() chain and answers with one in-org sample row. */
function recordingClient(chains: Chain[], tool: () => string) {
  const sample = {
    id: LEAD, organization_id: ORG, name: "Jane Doe", first_name: "Jane", last_name: "Doe", email: "jane@acme.test",
    stage: "proposal", value: 100, probability: 50, converted_at: null, updated_at: BASELINE, created_at: BASELINE,
    stage_changed_at: BASELINE, close_date: null, tags: [],
  };
  return {
    from(table: string) {
      const chain: Chain = { tool: tool(), table, op: "select", eqs: [], payload: null };
      chains.push(chain);
      let mode: "many" | "one" = "many";
      const q: Record<string, unknown> = {};
      const self = () => q;
      for (const m of ["select", "in", "is", "not", "lt", "gte", "lte", "or", "order", "range", "limit"]) q[m] = self;
      q.insert = (v: unknown) => { chain.op = "insert"; chain.payload = v; return q; };
      q.update = (v: unknown) => { chain.op = "update"; chain.payload = v; return q; };
      q.delete = () => { chain.op = "delete"; return q; };
      q.eq = (c: string, v: unknown) => { chain.eqs.push([c, v]); return q; };
      q.single = q.maybeSingle = () => { mode = "one"; return q; };
      q.then = (resolve: (v: unknown) => unknown) => {
        const row = chain.op === "insert" ? { ...sample, ...(chain.payload as object) } : sample;
        return Promise.resolve({ data: mode === "one" ? row : [row], error: null, count: 1 }).then(resolve);
      };
      return q;
    },
  };
}

const SAMPLE_INPUTS: Record<string, Record<string, unknown>> = {
  get_workspace_summary: {},
  search_leads: { search: "jane" },
  get_lead: { id: LEAD },
  list_followups: { when: "upcoming" },
  search_deals: { search: "acme" },
  get_deal: { id: LEAD },
  search_customers: { search: "acme" },
  get_customer: { id: LEAD },
  search_contacts: { search: "x", lead_id: LEAD },
  list_activities: { related_type: "lead", related_id: LEAD },
  list_calendar_events: {},
  list_campaigns: {},
  create_lead: { name: "New", email: "new@acme.test" },
  update_lead: { id: LEAD, status: "cold" },
  set_followup: { lead_id: LEAD, due: "2026-10-08" },
  convert_lead_to_customer: { lead_id: LEAD },
  create_deal: { name: "Deal", customer_id: LEAD },
  update_deal: { id: LEAD, stage: "negotiation", customer_id: LEAD },
  create_customer: { first_name: "Ann", email: "ann@acme.test" },
  update_customer: { id: LEAD, plan: "pro" },
  create_contact: { name: "Bob", lead_id: LEAD, customer_id: LEAD },
  update_contact: { id: LEAD, title: "CTO", lead_id: LEAD },
  create_activity: { type: "task", title: "Call", related_type: "deal", related_id: LEAD },
  update_activity: { id: LEAD, status: "completed", related_type: "lead", related_id: LEAD },
  create_calendar_event: { title: "Demo", date: "2026-10-08", related_type: "customer", related_id: LEAD },
  add_note: { record_type: "lead", record_id: LEAD, content: "Called" },
};

/**
 * Chains allowed without an organization_id predicate, each with its reason. Anything else
 * that lacks one fails the test by name.
 */
function exemption(chain: Chain): string | null {
  if (chain.table === "organizations" && chain.eqs.some(([c, v]) => c === "id" && v === ORG)) return "the org row itself";
  if (chain.table === "profiles" && chain.op === "select") return "note author lookup by the caller's own user id";
  const childTables = ["lead_notes", "lead_activities", "deal_notes", "deal_activities", "customer_notes", "customer_activities"];
  if (childTables.includes(chain.table)) return "child rows keyed by a parent id the handler verified in-org first";
  return null;
}

describe("org scoping", () => {
  it("every exposed MCP handler scopes each .from() chain to ctx.orgId, or the test names the offender", async () => {
    const mcpTools = listRegistryTools("chat").filter((t) => COPILOT_READ_TOOLS.includes(t.name) || COPILOT_WRITE_TOOLS.includes(t.name));
    expect(mcpTools.map((t) => t.name).filter((n) => !SAMPLE_INPUTS[n])).toEqual([]);

    const chains: Chain[] = [];
    let current = "";
    const client = recordingClient(chains, () => current);
    for (const t of mcpTools) {
      current = t.name;
      const result = await executeRegistryTool(t.name, SAMPLE_INPUTS[t.name], envFor("chat", client));
      expect(result.ok, `${t.name}: ${JSON.stringify(result)}`).toBe(true);
    }
    // Every tool exercised at least one chain.
    for (const t of mcpTools) expect(chains.some((c) => c.tool === t.name), t.name).toBe(true);

    const offenders = chains
      .filter((c) => {
        const scopedByEq = c.eqs.some(([col, v]) => col === "organization_id" && v === ORG);
        const scopedInsert = c.op === "insert" && (c.payload as { organization_id?: unknown })?.organization_id === ORG;
        return !scopedByEq && !scopedInsert && !exemption(c);
      })
      .map((c) => `${c.tool}: ${c.table}.${c.op}`);
    expect(offenders).toEqual([]);
  });
});
