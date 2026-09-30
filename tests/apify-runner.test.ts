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
