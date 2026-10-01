import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "org-123";
const USER = "user-456";

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };

const queries: Query[] = [];
type Result = { data: unknown; error: { message: string } | null };
let result: Result = { data: [], error: null };
/** Per-query results, consumed in await order; `result` answers once the queue is empty. */
let results: Result[] = [];

// Chainable fake: records every method call, resolves to `result` when awaited.
function makeBuilder(query: Query) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    query.calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "update", "delete", "insert", "eq", "in", "or", "order", "limit", "maybeSingle", "single"]) {
    builder[m] = record(m);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(results.length ? results.shift() : result).then(resolve, reject);
  return builder;
}

const fakeClient = {
  from: (table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    return makeBuilder(query);
  },
  auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient, createAdminClient: () => fakeClient }));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => ORG }));
vi.mock("@/lib/ai/client", () => ({ getAIClient: vi.fn(), callAIWithFallback: vi.fn() }));
vi.mock("@/lib/ai/models", () => ({ getModelForFeature: vi.fn() }));

import * as copilot from "@/lib/actions/copilot";
import {
  createCopilotTask,
  createMemoryItem,
  deleteConversation,
  listIcpProfiles,
  listMemoryByType,
  saveGuidance,
  updateMemoryItem,
} from "@/lib/actions/copilot";

const CAP_MESSAGE = "Guidance is limited to 10 active rules";
const hasOrgEq = (q: Query) =>
  q.calls.some((c) => c.method === "eq" && c.args[0] === "organization_id" && c.args[1] === ORG);

const hasUserEq = (q: Query) =>
  q.calls.some((c) => c.method === "eq" && c.args[0] === "user_id" && c.args[1] === USER);
const methodsOf = (q: Query) => q.calls.map((c) => c.method);

beforeEach(() => {
  queries.length = 0;
  result = { data: [], error: null };
  results = [];
});

describe("saveGuidance", () => {
  it("maps the guidance_cap_exceeded DB error to the 10-rule message on insert", async () => {
    result = { data: null, error: { message: "guidance_cap_exceeded" } };
    const res = await saveGuidance("Always reply in British English");

    expect(res).toEqual({ error: CAP_MESSAGE, data: null });
    expect(queries[0].calls.some((c) => c.method === "insert")).toBe(true);
  });

  it("maps the cap error when the message is wrapped by the driver", async () => {
    result = { data: null, error: { message: "P0001: guidance_cap_exceeded (context: trigger)" } };
    expect(await saveGuidance("A rule")).toEqual({ error: CAP_MESSAGE, data: null });
  });

  it("maps the cap error on edit too", async () => {
    result = { data: null, error: { message: "guidance_cap_exceeded" } };
    expect(await saveGuidance("Edited rule", "g1")).toEqual({ error: CAP_MESSAGE, data: null });
  });

  it("passes other database errors through unchanged", async () => {
    result = { data: null, error: { message: "connection reset" } };
    expect(await saveGuidance("A rule")).toEqual({ error: "connection reset", data: null });
  });

  it("inserts an active, user-sourced guidance row scoped to the org and caller", async () => {
    result = { data: { id: "g1" }, error: null };
    const res = await saveGuidance("  Never mention competitors by name  ");

    expect(res).toEqual({ data: { id: "g1" } });
    const insert = queries[0].calls.find((c) => c.method === "insert")!;
    expect(queries[0].table).toBe("copilot_memory");
    expect(insert.args[0]).toMatchObject({
      organization_id: ORG,
      user_id: USER,
      type: "guidance",
      source: "user",
      content: "Never mention competitors by name",
    });
  });

  it("edits only the org's guidance row with that id", async () => {
    result = { data: { id: "g1", content: "New text" }, error: null };
    await saveGuidance("New text", "g1");

    const q = queries[0];
    expect(q.calls.some((c) => c.method === "insert")).toBe(false);
    expect(q.calls).toContainEqual({ method: "eq", args: ["id", "g1"] });
    expect(q.calls).toContainEqual({ method: "eq", args: ["type", "guidance"] });
    expect(hasOrgEq(q)).toBe(true);
  });

  it("reports Not found when the edited rule does not exist in the org", async () => {
    result = { data: null, error: null };
    expect(await saveGuidance("Text", "missing")).toEqual({ error: "Not found", data: null });
  });

  it("rejects empty and oversized content without touching the database", async () => {
    expect((await saveGuidance("   ")).error).toBe("Guidance cannot be empty");
    expect((await saveGuidance("x".repeat(501))).error).toMatch(/500 characters/);
    expect(queries).toHaveLength(0);
  });
});

describe("updateMemoryItem", () => {
  it("maps the cap error when reactivating a guidance rule", async () => {
    result = { data: null, error: { message: "guidance_cap_exceeded" } };
    expect(await updateMemoryItem("g1", { is_active: true })).toEqual({ error: CAP_MESSAGE });
  });
});

describe("listIcpProfiles", () => {
  it("filters icp_profiles by organization_id", async () => {
    result = { data: [{ id: "p1", name: "SaaS", description: null, is_primary: true }], error: null };
    const res = await listIcpProfiles();

    expect(res).toEqual({ data: [{ id: "p1", name: "SaaS", description: null, is_primary: true }] });
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("icp_profiles");
    expect(hasOrgEq(queries[0])).toBe(true);
  });

  it("is read-only", async () => {
    await listIcpProfiles();
    const methods = queries[0].calls.map((c) => c.method);
    expect(methods).not.toContain("insert");
    expect(methods).not.toContain("update");
    expect(methods).not.toContain("delete");
  });

  it("returns an empty list with the error message on failure", async () => {
    result = { data: null, error: { message: "boom" } };
    expect(await listIcpProfiles()).toEqual({ error: "boom", data: [] });
  });
});

describe("listMemoryByType", () => {
  it("scopes by organization_id and the requested types", async () => {
    await listMemoryByType(["guidance", "custom"]);

    expect(queries[0].table).toBe("copilot_memory");
    expect(hasOrgEq(queries[0])).toBe(true);
    expect(queries[0].calls).toContainEqual({ method: "in", args: ["type", ["guidance", "custom"]] });
  });
});

describe("removed message writers", () => {
  it("no longer exports saveMessage (migration 044 blocks client writes)", () => {
    expect("saveMessage" in copilot).toBe(false);
  });
});

describe("owner fields cannot be overridden by client input", () => {
  const FORGED = { organization_id: "other-org", user_id: "other-user" };

  it("createMemoryItem writes the caller's org and user even when the input carries others", async () => {
    result = { data: { id: "m1" }, error: null };
    const item = { type: "custom", title: "T", content: "C", ...FORGED } as unknown as Parameters<typeof createMemoryItem>[0];

    await createMemoryItem(item);

    const insert = queries[0].calls.find((c) => c.method === "insert")!;
    expect(queries[0].table).toBe("copilot_memory");
    expect(insert.args[0]).toMatchObject({ organization_id: ORG, user_id: USER, title: "T", content: "C" });
  });

  it("createCopilotTask writes the caller's org and user even when the input carries others", async () => {
    result = { data: { id: "t1" }, error: null };
    const task = { title: "T", prompt: "P", schedule: "daily", ...FORGED } as unknown as Parameters<
      typeof createCopilotTask
    >[0];

    await createCopilotTask(task);

    const insert = queries[0].calls.find((c) => c.method === "insert")!;
    expect(queries[0].table).toBe("copilot_tasks");
    expect(insert.args[0]).toMatchObject({ organization_id: ORG, user_id: USER, title: "T", prompt: "P" });
  });
});

describe("deleteConversation", () => {
  const future = () => new Date(Date.now() + 60_000).toISOString();

  it("looks the conversation up by id, org AND user", async () => {
    results = [{ data: [], error: null }];

    expect(await deleteConversation("c1")).toEqual({ error: "Not found" });

    expect(queries).toHaveLength(1);
    const lookup = queries[0];
    expect(lookup.table).toBe("copilot_conversations");
    expect(hasOrgEq(lookup)).toBe(true);
    expect(hasUserEq(lookup)).toBe(true);
    expect(lookup.calls).toContainEqual({ method: "in", args: ["id", ["c1"]] });
    expect(methodsOf(lookup)).not.toContain("delete");
  });

  it("refuses with turn_in_progress while the turn lock is held, and deletes nothing", async () => {
    results = [{ data: [{ id: "c1", turn_lock_until: future() }], error: null }];

    expect(await deleteConversation("c1")).toEqual({ error: "turn_in_progress" });

    expect(queries).toHaveLength(1);
    expect(queries.some((q) => methodsOf(q).includes("delete") || methodsOf(q).includes("update"))).toBe(false);
  });

  it("detaches kept and task-sourced approvals, then deletes by id, org AND user", async () => {
    results = [
      { data: [{ id: "c1", turn_lock_until: null }], error: null },
      { data: null, error: null },
      { data: [{ id: "c1" }], error: null },
    ];

    expect(await deleteConversation("c1")).toEqual({ success: true });

    expect(queries.map((q) => q.table)).toEqual(["copilot_conversations", "copilot_approvals", "copilot_conversations"]);
    const [, detach, del] = queries;

    expect(detach.calls).toContainEqual({ method: "update", args: [{ conversation_id: null }] });
    expect(hasOrgEq(detach)).toBe(true);
    expect(detach.calls).toContainEqual({ method: "in", args: ["conversation_id", ["c1"]] });
    expect(detach.calls).toContainEqual({
      method: "or",
      args: ["source.eq.task,status.in.(approved,applied,failed,stale)"],
    });

    expect(methodsOf(del)).toContain("delete");
    expect(hasOrgEq(del)).toBe(true);
    expect(hasUserEq(del)).toBe(true);
    expect(del.calls).toContainEqual({ method: "in", args: ["id", ["c1"]] });
  });

  it("returns an error instead of deleting when keeping the approvals fails", async () => {
    results = [
      { data: [{ id: "c1", turn_lock_until: null }], error: null },
      { data: null, error: { message: "boom" } },
    ];
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await deleteConversation("c1")).toEqual({ error: "Could not delete the conversation" });

    expect(queries.some((q) => methodsOf(q).includes("delete"))).toBe(false);
    spy.mockRestore();
  });
});
