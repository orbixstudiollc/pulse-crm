import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "org-123";
const USER = "user-456";

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };

const queries: Query[] = [];
let result: { data: unknown; error: { message: string } | null; count?: number } = { data: [], error: null };

// Chainable fake: records every method call, resolves to `result` when awaited.
function makeBuilder(query: Query) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    query.calls.push({ method, args });
    return builder;
  };
  for (const m of [
    "select", "update", "delete", "insert", "eq", "is", "not", "or", "ilike", "order", "limit", "maybeSingle", "single",
  ]) {
    builder[m] = record(m);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
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

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => ORG }));

import {
  deleteArtifact,
  getArtifact,
  listArtifacts,
  listArtifactsForRecord,
  restoreArtifact,
  setArtifactStarred,
} from "@/lib/actions/copilot-artifacts";
import { listNotifications, markAllRead, markNotificationRead, unreadCount } from "@/lib/actions/notifications";
import { listConversations } from "@/lib/actions/copilot-conversations";

const methods = (q: Query) => q.calls.map((c) => c.method);
const hasOrgEq = (q: Query) =>
  q.calls.some((c) => c.method === "eq" && c.args[0] === "organization_id" && c.args[1] === ORG);

beforeEach(() => {
  queries.length = 0;
  result = { data: [], error: null };
});

describe("copilot-artifacts actions", () => {
  it("scopes every artifact call by organization_id", async () => {
    result = { data: [{ id: "a1" }], error: null };
    await listArtifacts({ q: "x", kind: "report", starred: true, limit: 10 });
    await getArtifact("a1");
    await setArtifactStarred("a1", true);
    await deleteArtifact("a1");
    await restoreArtifact("a1");
    await listArtifactsForRecord("lead", "l1");

    expect(queries).toHaveLength(6);
    for (const q of queries) {
      expect(q.table).toBe("copilot_artifacts");
      expect(hasOrgEq(q)).toBe(true);
    }
  });

  it("deleteArtifact soft-deletes via update of deleted_at and never calls delete()", async () => {
    result = { data: [{ id: "a1" }], error: null };
    const res = await deleteArtifact("a1");

    expect(res).toEqual({ success: true });
    const q = queries[0];
    expect(methods(q)).toContain("update");
    expect(methods(q)).not.toContain("delete");
    const update = q.calls.find((c) => c.method === "update")!;
    const values = update.args[0] as Record<string, unknown>;
    expect(typeof values.deleted_at).toBe("string");
    expect(Number.isNaN(Date.parse(values.deleted_at as string))).toBe(false);
    expect(q.calls).toContainEqual({ method: "eq", args: ["id", "a1"] });
  });

  it("deleteArtifact reports Not found when no row matched (other org / already deleted)", async () => {
    result = { data: [], error: null };
    expect(await deleteArtifact("nope")).toEqual({ error: "Not found" });
  });

  it("restoreArtifact clears deleted_at and only targets deleted rows", async () => {
    result = { data: [{ id: "a1" }], error: null };
    await restoreArtifact("a1");
    const q = queries[0];
    const update = q.calls.find((c) => c.method === "update")!;
    expect((update.args[0] as Record<string, unknown>).deleted_at).toBeNull();
    expect(q.calls).toContainEqual({ method: "not", args: ["deleted_at", "is", null] });
    expect(methods(q)).not.toContain("delete");
  });

  it("listArtifacts excludes deleted rows and applies filters", async () => {
    await listArtifacts({ q: "100%_off", kind: "email_draft", starred: true, limit: 7 });
    const q = queries[0];
    expect(q.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
    expect(q.calls).toContainEqual({ method: "eq", args: ["kind", "email_draft"] });
    expect(q.calls).toContainEqual({ method: "eq", args: ["starred", true] });
    expect(q.calls).toContainEqual({ method: "ilike", args: ["title", "%100\\%\\_off%"] });
    expect(q.calls).toContainEqual({ method: "limit", args: [7] });
  });

  it("listArtifactsForRecord filters by record, hides deleted, defaults to 5", async () => {
    await listArtifactsForRecord("deal", "d9");
    const q = queries[0];
    expect(q.calls).toContainEqual({ method: "eq", args: ["linked_record_type", "deal"] });
    expect(q.calls).toContainEqual({ method: "eq", args: ["linked_record_id", "d9"] });
    expect(q.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
    expect(q.calls).toContainEqual({ method: "limit", args: [5] });
  });

  it("throws on a read error instead of returning empty data", async () => {
    result = { data: null, error: { message: "boom" } };
    await expect(listArtifacts()).rejects.toThrow("boom");
  });
});

describe("notifications actions", () => {
  const mineFilter = `user_id.is.null,user_id.eq.${USER}`;

  it("scopes every call by organization_id and to the caller's or org-wide rows", async () => {
    result = { data: [{ id: "n1" }], error: null, count: 3 };
    await listNotifications();
    await markNotificationRead("n1");
    await markAllRead();
    await unreadCount();

    expect(queries).toHaveLength(4);
    for (const q of queries) {
      expect(q.table).toBe("notifications");
      expect(hasOrgEq(q)).toBe(true);
      expect(q.calls).toContainEqual({ method: "or", args: [mineFilter] });
    }
    expect(queries[0].calls).toContainEqual({ method: "limit", args: [20] });
  });

  it("unreadCount counts unread rows only", async () => {
    result = { data: null, error: null, count: 4 };
    expect(await unreadCount()).toBe(4);
    expect(queries[0].calls).toContainEqual({ method: "is", args: ["read_at", null] });
  });

  it("markNotificationRead sets read_at and reports Not found when nothing matched", async () => {
    result = { data: [], error: null };
    expect(await markNotificationRead("n1")).toEqual({ error: "Not found" });
    const update = queries[0].calls.find((c) => c.method === "update")!;
    expect(typeof (update.args[0] as Record<string, unknown>).read_at).toBe("string");
  });
});

describe("copilot-conversations actions", () => {
  it("listConversations is scoped by organization_id and the caller's user_id", async () => {
    await listConversations();
    const q = queries[0];
    expect(q.table).toBe("copilot_conversations");
    expect(hasOrgEq(q)).toBe(true);
    expect(q.calls).toContainEqual({ method: "eq", args: ["user_id", USER] });
  });
});
