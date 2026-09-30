// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// worker.ts is a server module; stub its server-only / DB imports so the
// drain loop can be exercised with injected claim/process functions.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => {
    throw new Error("DB access not expected in this test");
  },
}));
vi.mock("@/lib/lead-finder/enrichment/pipeline", () => ({
  enrichSingleLead: vi.fn(),
}));
vi.mock("@/lib/lead-finder/apify/runner", () => ({
  ApifyError: class ApifyError extends Error {},
}));
vi.mock("@/lib/lead-finder/obsidian/observer", () => ({
  writeLeadObservation: vi.fn(),
}));

import {
  drainEnrichmentJobs,
  type ClaimedJob,
  type DrainDeps,
} from "@/lib/lead-finder/enrichment/worker";

function makeJob(n: number): ClaimedJob {
  return {
    id: `job-${n}`,
    organization_id: "org-1",
    batch_id: "batch-1",
    lead_id: `lead-${n}`,
    actor_ids: [],
    attempts: 0,
  };
}

/** A fake queue of `size` jobs; claim hands out up to `limit` at a time. */
function fakeDeps(size: number, overrides: Partial<DrainDeps> = {}) {
  let next = 0;
  const claim = vi.fn(async (limit: number) => {
    const jobs: ClaimedJob[] = [];
    while (jobs.length < limit && next < size) jobs.push(makeJob(next++));
    return jobs;
  });
  const process = vi.fn(async () => ({ rateLimited: false, failed: false }));
  const deps: Partial<DrainDeps> = {
    claim,
    process,
    countRemaining: async () => size - next,
    prepare: async () => {},
    afterCycle: async () => {},
    isPaused: () => false,
    now: () => 0,
    ...overrides,
  };
  return { deps, claim, process };
}

describe("drainEnrichmentJobs", () => {
  it("stops once maxJobs have been processed", async () => {
    const { deps, process, claim } = fakeDeps(20);

    const result = await drainEnrichmentJobs(
      { maxJobs: 5, deadlineMs: 60_000 },
      deps
    );

    expect(result).toEqual({ processed: 5, failed: 0, remaining: 15 });
    expect(process).toHaveBeenCalledTimes(5);
    for (const [limit] of claim.mock.calls) expect(limit).toBeLessThanOrEqual(5);
  });

  it("stops when the queue is empty", async () => {
    const { deps, process } = fakeDeps(4);

    const result = await drainEnrichmentJobs(
      { maxJobs: 50, deadlineMs: 60_000 },
      deps
    );

    expect(result).toEqual({ processed: 4, failed: 0, remaining: 0 });
    expect(process).toHaveBeenCalledTimes(4);
  });

  it("does not start a new cycle after the deadline", async () => {
    let clock = 0;
    const { deps, claim } = fakeDeps(100, {
      now: () => clock,
      // Each cycle "takes" 400ms of wall time.
      afterCycle: async () => {
        clock += 400;
      },
    });

    const result = await drainEnrichmentJobs(
      { maxJobs: 100, deadlineMs: 1_000 },
      deps
    );

    // Cycles start at t=0, 400, 800; the one at t=1200 is skipped.
    expect(claim).toHaveBeenCalledTimes(3);
    expect(result.processed).toBeGreaterThan(0);
    expect(result.processed).toBeLessThan(100);
    expect(result.remaining).toBe(100 - result.processed);
  });

  it("counts failed outcomes and rejected jobs as failed, awaiting all of them", async () => {
    let call = 0;
    const { deps } = fakeDeps(3, {
      process: async () => {
        call += 1;
        if (call === 1) return { rateLimited: false, failed: true };
        if (call === 2) throw new Error("boom");
        return { rateLimited: false, failed: false };
      },
    });

    const result = await drainEnrichmentJobs(
      { maxJobs: 3, deadlineMs: 60_000 },
      deps
    );

    expect(result).toEqual({ processed: 3, failed: 2, remaining: 0 });
  });

  it("does nothing while the instance is cooling down", async () => {
    const { deps, claim } = fakeDeps(10, { isPaused: () => true });

    const result = await drainEnrichmentJobs(
      { maxJobs: 50, deadlineMs: 60_000 },
      deps
    );

    expect(claim).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, failed: 0, remaining: 10 });
  });
});
