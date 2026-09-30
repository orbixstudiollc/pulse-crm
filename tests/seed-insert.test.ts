// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateSeed } from "@/lib/seed/generate";
import { insertSeed } from "@/lib/seed/insert";

type Row = Record<string, unknown> & { id: string };
type Outcome = "ok" | "throw" | { code?: string; message: string };

interface Call {
  table: string;
  rows: Row[];
  options: unknown;
}

// Fake Supabase client: `upsert` resolves per a scripted list of outcomes for
// each table (one outcome per attempt; "ok" once the script runs out).
function fakeClient(script: Record<string, Outcome[]> = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: Row[], options: unknown) {
          calls.push({ table, rows, options });
          const outcome = script[table]?.shift() ?? "ok";
          if (outcome === "throw") return Promise.reject(new TypeError("fetch failed"));
          if (outcome === "ok") return Promise.resolve({ data: null, error: null });
          return Promise.resolve({ data: null, error: outcome });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, calls };
}

const noSleep = async () => {};
const ORG = "00000000-0000-4000-8000-000000000001";

describe("insertSeed", () => {
  it("seeds every table once when nothing fails", async () => {
    const { client, calls } = fakeClient();
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    expect(result.errors).toEqual([]);
    expect(calls.filter((c) => c.table === "leads")).toHaveLength(1);
    expect(result.inserted).toBeGreaterThan(0);
  });

  it("retries a transient network failure with the same rows and ids", async () => {
    const { client, calls } = fakeClient({ leads: ["throw", "ok"] });
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    const leadCalls = calls.filter((c) => c.table === "leads");
    expect(result.errors).toEqual([]);
    expect(leadCalls).toHaveLength(2);
    expect(leadCalls[1].rows.map((r) => r.id)).toEqual(leadCalls[0].rows.map((r) => r.id));
    // A retry must not duplicate rows if the first attempt was committed.
    expect(leadCalls[1].options).toMatchObject({ onConflict: "id", ignoreDuplicates: true });
  });

  it("retries an error object without a SQLSTATE code", async () => {
    const { client, calls } = fakeClient({ leads: [{ message: "TypeError: fetch failed", code: "" }] });
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    expect(result.errors).toEqual([]);
    expect(calls.filter((c) => c.table === "leads")).toHaveLength(2);
  });

  it("does not retry a database error and reports it", async () => {
    const { client, calls } = fakeClient({ leads: [{ code: "42501", message: "permission denied" }] });
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    expect(calls.filter((c) => c.table === "leads")).toHaveLength(1);
    expect(result.errors).toEqual(["Leads: permission denied"]);
  });

  it("gives up after three attempts and skips that parent's children", async () => {
    const { client, calls } = fakeClient({ customers: ["throw", "throw", "throw"] });
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    expect(calls.filter((c) => c.table === "customers")).toHaveLength(3);
    expect(result.errors).toEqual(["Customers: fetch failed"]);
    expect(calls.some((c) => c.table === "deals" || c.table === "contacts")).toBe(false);
  });

  it("links children to the parent ids it assigned", async () => {
    const { client, calls } = fakeClient();
    await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    const customerIds = new Set(calls.find((c) => c.table === "customers")!.rows.map((r) => r.id));
    const deals = calls.find((c) => c.table === "deals")!.rows;
    expect(deals.length).toBeGreaterThan(0);
    expect(deals.every((d) => customerIds.has(d.customer_id as string))).toBe(true);
  });

  it("treats the default scoring profile conflict as success", async () => {
    const { client } = fakeClient({ scoring_profiles: [{ code: "23505", message: "duplicate key" }] });
    const result = await insertSeed(client, ORG, generateSeed(ORG), { sleep: noSleep });

    expect(result.errors).toEqual([]);
  });
});
