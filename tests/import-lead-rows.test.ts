import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "org-123";

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };
type Result = { data?: unknown; error: { message: string } | null; count?: number };

const queries: Query[] = [];
// Each awaited query takes the next queued result; the fallback is a plain success.
let queue: Result[] = [];
let isAnonymous = false;
let nextId = 0;

function makeBuilder(query: Query) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    query.calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "insert", "eq", "single"]) builder[m] = record(m);
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    const next = queue.shift() ?? defaultResult(query);
    return Promise.resolve(next).then(resolve, reject);
  };
  return builder;
}

// Default: inserts succeed and return one id per inserted row.
function defaultResult(query: Query): Result {
  const insert = query.calls.find((c) => c.method === "insert");
  if (!insert) return { data: [], error: null };
  const rows = Array.isArray(insert.args[0]) ? insert.args[0] : [insert.args[0]];
  const ids = rows.map(() => ({ id: `id-${++nextId}` }));
  const single = query.calls.some((c) => c.method === "single");
  return { data: single ? ids[0] : ids, error: null };
}

const fakeClient = {
  from: (table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    return makeBuilder(query);
  },
  auth: { getUser: async () => ({ data: { user: { id: "u1", is_anonymous: isAnonymous } } }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/actions/helpers", () => ({ getOrgId: async () => ORG }));

import { importLeadRows } from "@/lib/actions/import";
import { GUEST_MAX_LEADS, mapRowToLead } from "@/lib/import/lead-rows";

const insertedRows = (q: Query) => {
  const insert = q.calls.find((c) => c.method === "insert");
  return insert ? (Array.isArray(insert.args[0]) ? insert.args[0] : [insert.args[0]]) : [];
};
const insertQueries = () => queries.filter((q) => q.calls.some((c) => c.method === "insert"));

beforeEach(() => {
  queries.length = 0;
  queue = [];
  isAnonymous = false;
  nextId = 0;
});

describe("mapRowToLead", () => {
  const headers = ["Name", "Email", "Value", "Staff", "Tags", "Notes"];
  const mapping = {
    Name: "name",
    Email: "email",
    Value: "estimated_value",
    Staff: "employees",
    Tags: "tags",
    Notes: "__skip__",
  };

  it("applies defaults and coerces typed fields", () => {
    const res = mapRowToLead(headers, ["Ann", "a@x.com", "$1,250.50", "1,200 people", "saas, ai ,", "skip me"], mapping, ORG);
    expect(res).toEqual({
      lead: {
        organization_id: ORG,
        status: "cold",
        source: "Website",
        score: 50,
        name: "Ann",
        email: "a@x.com",
        estimated_value: 1250.5,
        employees: 1200,
        tags: ["saas", "ai"],
      },
    });
  });

  it("falls back for unparseable numbers and skips empty cells", () => {
    const res = mapRowToLead(headers, ["Ann", "", "n/a", "many", "  ", ""], mapping, ORG);
    expect(res).toMatchObject({ lead: { name: "Ann", estimated_value: 0, employees: null } });
    expect("lead" in res && "email" in res.lead).toBe(false);
    expect("lead" in res && "tags" in res.lead).toBe(false);
  });

  it("ignores invalid target fields and missing columns", () => {
    const res = mapRowToLead(["Name", "Bad"], ["Ann", "x"], { Name: "name", Bad: "organization_id", Gone: "email" }, ORG);
    expect(res).toEqual({
      lead: { organization_id: ORG, status: "cold", source: "Website", estimated_value: 0, score: 50, name: "Ann" },
    });
  });

  it("requires a name or an email", () => {
    expect(mapRowToLead(headers, ["", "", "5"], mapping, ORG)).toEqual({
      error: "Missing both name and email, skipped",
    });
    expect(mapRowToLead(headers, ["", "only@email.com"], mapping, ORG)).toMatchObject({
      lead: { email: "only@email.com" },
    });
  });
});

describe("importLeadRows", () => {
  const headers = ["name", "email"];
  const mapping = { name: "name", email: "email" };

  it("rejects more than 500 rows without touching the database", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => [`n${i}`, `e${i}@x.com`]);
    const res = await importLeadRows({ headers, rows, mapping, firstRowNumber: 2 });
    expect(res).toMatchObject({ error: expect.stringContaining("Invalid import batch") });
    expect(queries).toHaveLength(0);
  });

  it("accepts exactly 500 rows in one insert", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => [`n${i}`, `e${i}@x.com`]);
    const res = await importLeadRows({ headers, rows, mapping, firstRowNumber: 2 });
    expect(res).toMatchObject({ imported: 500, errors: [] });
    expect(insertQueries()).toHaveLength(1);
  });

  it("rejects an oversized cell, too many headers, bad mapping and bad row numbers", async () => {
    const big = "x".repeat(10_001);
    const cases = [
      { headers, rows: [["Ann", big]], mapping, firstRowNumber: 2 },
      { headers: Array.from({ length: 201 }, (_, i) => `h${i}`), rows: [], mapping, firstRowNumber: 2 },
      { headers, rows: [["Ann", "a@x.com"]], mapping: { name: "organization_id" }, firstRowNumber: 2 },
      { headers, rows: [["Ann", "a@x.com"]], mapping, firstRowNumber: 0 },
      { headers, rows: [["Ann", "a@x.com"]], mapping, firstRowNumber: 1.5 },
    ];
    for (const input of cases) {
      expect(await importLeadRows(input)).toMatchObject({ error: expect.stringContaining("Invalid import batch") });
    }
    expect(queries).toHaveLength(0);
  });

  it("inserts the batch scoped to the org and reports real row numbers for skipped rows", async () => {
    const rows = [["Ann", "a@x.com"], ["", ""], ["Bob", ""]];
    const res = await importLeadRows({ headers, rows, mapping: { ...mapping, extra: "__skip__" }, firstRowNumber: 1002 });
    expect(res).toEqual({
      imported: 2,
      importedIds: ["id-1", "id-2"],
      errors: ["Row 1003: Missing both name and email, skipped"],
    });
    const inserted = insertedRows(insertQueries()[0]) as Array<Record<string, unknown>>;
    expect(inserted.map((l) => l.organization_id)).toEqual([ORG, ORG]);
  });

  it("falls back to row-by-row inserts with the real CSV row numbers", async () => {
    const rows = [["Ann", "a@x.com"], ["", ""], ["Bob", "b@x.com"], ["Cy", "c@x.com"]];
    queue = [
      { data: null, error: { message: "batch failed" } },
      { data: { id: "ann" }, error: null },
      { data: null, error: { message: "duplicate key" } },
      { data: { id: "cy" }, error: null },
    ];
    const res = await importLeadRows({ headers, rows, mapping, firstRowNumber: 501 });
    expect(res).toEqual({
      imported: 2,
      importedIds: ["ann", "cy"],
      errors: ["Row 502: Missing both name and email, skipped", "Row 503: duplicate key"],
    });
    expect(insertQueries()).toHaveLength(4);
  });

  it("does not check the guest cap for signed-up users", async () => {
    await importLeadRows({ headers, rows: [["Ann", "a@x.com"]], mapping, firstRowNumber: 2 });
    expect(queries.some((q) => q.calls.some((c) => c.method === "select" && (c.args[1] as { head?: boolean })?.head))).toBe(false);
  });

  it("caps guest workspaces at GUEST_MAX_LEADS and flags the cut", async () => {
    isAnonymous = true;
    queue = [{ data: null, error: null, count: GUEST_MAX_LEADS - 2 }];
    const rows = [["A", ""], ["B", ""], ["C", ""], ["D", ""]];
    const res = await importLeadRows({ headers, rows, mapping, firstRowNumber: 2 });

    expect(res).toMatchObject({ imported: 2, guestLimitReached: true });
    const countQuery = queries[0];
    expect(countQuery.calls).toContainEqual({ method: "select", args: ["id", { count: "exact", head: true }] });
    expect(countQuery.calls).toContainEqual({ method: "eq", args: ["organization_id", ORG] });
    expect(insertedRows(insertQueries()[0]).map((l) => (l as { name: string }).name)).toEqual(["A", "B"]);
  });

  it("inserts nothing once a guest workspace is full", async () => {
    isAnonymous = true;
    queue = [{ data: null, error: null, count: GUEST_MAX_LEADS + 5 }];
    const res = await importLeadRows({ headers, rows: [["A", ""]], mapping, firstRowNumber: 2 });
    expect(res).toEqual({ imported: 0, importedIds: [], errors: [], guestLimitReached: true });
    expect(insertQueries()).toHaveLength(0);
  });

  it("does not flag guests whose rows all fit", async () => {
    isAnonymous = true;
    queue = [{ data: null, error: null, count: 10 }];
    const res = await importLeadRows({ headers, rows: [["A", ""]], mapping, firstRowNumber: 2 });
    expect(res).toEqual({ imported: 1, importedIds: ["id-1"], errors: [] });
  });
});
