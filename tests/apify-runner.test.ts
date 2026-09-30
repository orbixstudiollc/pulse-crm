// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// runner.ts is server-only and pulls in the Supabase server client and the
// actor policy; getRunStatus/mapApifyRunStatus use none of them.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/lead-finder/apify/policy-server", () => ({
  authorizeActors: vi.fn(),
}));

import {
  ApifyError,
  getRunStatus,
  mapApifyRunStatus,
} from "@/lib/lead-finder/apify/runner";

function mockFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapApifyRunStatus", () => {
  it("maps SUCCEEDED to succeeded with the dataset id and cost", () => {
    expect(
      mapApifyRunStatus({
        status: "SUCCEEDED",
        defaultDatasetId: "ds1",
        usageTotalUsd: 0.25,
      })
    ).toEqual({ status: "succeeded", datasetId: "ds1", costUsd: 0.25 });
  });

  it.each(["FAILED", "ABORTED", "TIMED-OUT"])(
    "maps %s to failed with the Apify status message",
    (apifyStatus) => {
      expect(
        mapApifyRunStatus({ status: apifyStatus, statusMessage: "boom" })
      ).toEqual({ status: "failed", error: "boom" });
    }
  );

  it("falls back to a generic error when Apify gives no status message", () => {
    expect(mapApifyRunStatus({ status: "TIMED-OUT" })).toEqual({
      status: "failed",
      error: "Actor run TIMED-OUT",
    });
  });

  it.each(["RUNNING", "READY", "TIMING-OUT", "ABORTING"])(
    "maps %s to running",
    (apifyStatus) => {
      expect(mapApifyRunStatus({ status: apifyStatus })).toEqual({
        status: "running",
      });
    }
  );

  it("treats a missing run object as running", () => {
    expect(mapApifyRunStatus(undefined)).toEqual({ status: "running" });
  });
});

describe("getRunStatus", () => {
  it("fetches the run with the token and maps its status", async () => {
    const fetchMock = mockFetchOnce({
      data: { status: "SUCCEEDED", defaultDatasetId: "ds9" },
    });

    await expect(getRunStatus("run1", "tok")).resolves.toEqual({
      status: "succeeded",
      datasetId: "ds9",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.apify.com/v2/actor-runs/run1",
      { headers: { Authorization: "Bearer tok" } }
    );
  });

  it("returns running for a READY run", async () => {
    mockFetchOnce({ data: { status: "READY" } });
    await expect(getRunStatus("run1", "tok")).resolves.toEqual({
      status: "running",
    });
  });

  it("throws an ApifyError when Apify rejects the request", async () => {
    mockFetchOnce({ error: { type: "x", message: "nope" } }, 401);
    await expect(getRunStatus("run1", "tok")).rejects.toBeInstanceOf(
      ApifyError
    );
  });
});

describe("recorded runs (lf_apify_runs) use the injected client", () => {
  type Call = { op: string; args: unknown[] };

  // Minimal chainable stand-in for SupabaseClient that records every call.
  function fakeDb() {
    const calls: Call[] = [];
    const builder: Record<string, unknown> = {};
    for (const op of ["insert", "update", "select", "eq"]) {
      builder[op] = (...args: unknown[]) => {
        calls.push({ op, args });
        return builder;
      };
    }
    builder.single = async () => ({ data: { id: "db1" }, error: null });
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });
    const db = {
      from: vi.fn((table: string) => {
        calls.push({ op: "from", args: [table] });
        return builder;
      }),
    };
    return { db, calls };
  }

  it("inserts the run record through the given client with organization_id", async () => {
    const { authorizeActors } = await import(
      "@/lib/lead-finder/apify/policy-server"
    );
    const { createClient, createAdminClient } = await import(
      "@/lib/supabase/server"
    );
    vi.mocked(authorizeActors).mockResolvedValue({ token: "tok" } as never);
    mockFetchOnce({ data: { id: "apify-run-1" } });
    const { db, calls } = fakeDb();

    const { startRecordedActorRun } = await import(
      "@/lib/lead-finder/apify/runner"
    );
    await expect(
      startRecordedActorRun(db as never, "owner/actor", { a: 1 }, "org-1", "camp-1")
    ).resolves.toEqual({ runId: "apify-run-1", dbId: "db1" });

    expect(db.from).toHaveBeenCalledWith("lf_apify_runs");
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.args[0]).toMatchObject({
      organization_id: "org-1",
      campaign_id: "camp-1",
      actor_id: "owner/actor",
    });
    // The run-id update is scoped by the org as well.
    expect(calls).toContainEqual({ op: "eq", args: ["organization_id", "org-1"] });
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("throws a wait-timeout ApifyError once maxWaitMs is spent", async () => {
    const { authorizeActors } = await import(
      "@/lib/lead-finder/apify/policy-server"
    );
    vi.mocked(authorizeActors).mockResolvedValue({ token: "tok" } as never);
    mockFetchOnce({ data: { status: "RUNNING" } });
    const { db, calls } = fakeDb();

    const { pollRunUntilDone, isApifyWaitTimeout } = await import(
      "@/lib/lead-finder/apify/runner"
    );
    const err = await pollRunUntilDone("run1", "org-1", "db1", {
      db: db as never,
      maxWaitMs: 0,
    }).catch((e: unknown) => e);

    expect(isApifyWaitTimeout(err)).toBe(true);
    const update = calls.find((c) => c.op === "update");
    expect(update?.args[0]).toMatchObject({ status: "failed" });
  });
});
