/**
 * Durable background enrichment worker (Pulse CRM parity with lead-finder).
 *
 * - Reads jobs from `lf_enrichment_jobs` (status in "queued"|"retry") across all orgs
 * - Runs enrichSingleLead() per claimed job, respecting per-org campaign concurrency
 * - On success: status="done"
 * - On failure: exponential backoff retry up to MAX_ATTEMPTS, then status="failed"
 * - On 429 / memory limit: pauses this instance for a cooling window
 * - Drained in bounded, awaited batches by drainEnrichmentJobs(), which the
 *   lead-finder-worker cron calls (serverless-safe: nothing keeps running after
 *   the response). workerPump() is a dev-only background loop over the same drain.
 *
 * All DB access uses the admin client so the worker can see/update jobs for every tenant.
 * Per-org isolation is preserved by explicit organization_id filters on every statement.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { enrichSingleLead } from "./pipeline";
import { ApifyError } from "../apify/runner";
import { leadEmitter } from "../events/emitter";
import { writeLeadObservation } from "../obsidian/observer";
import type {
  AIProvider,
  KpiDefinition,
  LeadFieldDefinition,
} from "../types";

// =============================================================================
// Tunables
// =============================================================================

const DEV_IDLE_MS = 5_000;
const STALE_RUNNING_MINUTES = 10;
const STALE_RETRY_HOURS = 6;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_PAUSE_MS = 60_000;
const APIFY_MEMORY_PAUSE_MS = 180_000;
const BACKOFF_BASE_MS = 30_000;
const MIN_ENRICHMENT_CONCURRENCY = 1;
const MAX_ENRICHMENT_CONCURRENCY = 50;
const DEFAULT_CONCURRENCY = 3;

// =============================================================================
// Per-instance state (cooling window, adaptive cap, dev loop guard)
// =============================================================================

const g = globalThis as unknown as {
  _lfEnrichWorkerRunning?: boolean;
  _lfEnrichWorkerPauseUntil?: number;
  _lfEnrichAdaptiveCap?: number;
  _lfEnrichStableCycles?: number;
};

function isPaused(): boolean {
  return (
    !!g._lfEnrichWorkerPauseUntil && Date.now() < g._lfEnrichWorkerPauseUntil
  );
}

function pauseForRateLimit() {
  const until = Date.now() + RATE_LIMIT_PAUSE_MS;
  g._lfEnrichWorkerPauseUntil = Math.max(
    g._lfEnrichWorkerPauseUntil ?? 0,
    until
  );
  console.warn(
    `[lf-worker] Rate-limited — pausing ${RATE_LIMIT_PAUSE_MS / 1000}s`
  );
}

function pauseForApifyMemory() {
  const until = Date.now() + APIFY_MEMORY_PAUSE_MS;
  g._lfEnrichWorkerPauseUntil = Math.max(
    g._lfEnrichWorkerPauseUntil ?? 0,
    until
  );
  console.warn(
    `[lf-worker] Apify memory constrained — pausing ${APIFY_MEMORY_PAUSE_MS / 1000}s`
  );
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.toLowerCase().includes("rate limit")
  );
}

function isApifyMemoryLimitError(err: unknown): boolean {
  if (err instanceof ApifyError && err.errorType === "memory-limit") return true;
  const msg = String(err).toLowerCase();
  return (
    msg.includes("memory limit") ||
    msg.includes("memory-limit") ||
    msg.includes("exceed the memory limit")
  );
}

function backoffMs(attempts: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
}

function withJitter(ms: number, ratio = 0.2): number {
  const spread = Math.max(0, Math.floor(ms * ratio));
  if (spread === 0) return ms;
  const offset = Math.floor(Math.random() * (spread * 2 + 1)) - spread;
  return Math.max(1_000, ms + offset);
}

function addMs(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Hygiene / queue integrity (admin client)
// =============================================================================

async function recoverStaleRunning(): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALE_RUNNING_MINUTES * 60_000
  ).toISOString();
  const { data: stale } = await supabase
    .from("lf_enrichment_jobs")
    .select("id, attempts")
    .eq("status", "running")
    .lt("started_at", cutoff);

  for (const row of stale ?? []) {
    await supabase
      .from("lf_enrichment_jobs")
      .update({
        status: "retry",
        attempts: (row.attempts ?? 0) + 1,
        next_attempt_at: new Date().toISOString(),
        last_error: "Recovered from stale running state",
      })
      .eq("id", row.id)
      .eq("status", "running");
  }
  if ((stale ?? []).length > 0) {
    console.log(
      `[lf-worker] Recovered ${(stale ?? []).length} stale running jobs → retry`
    );
  }
}

async function failAncientRetryJobs(): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALE_RETRY_HOURS * 3600_000
  ).toISOString();
  const { data: ancient } = await supabase
    .from("lf_enrichment_jobs")
    .select("id")
    .eq("status", "retry")
    .lt("started_at", cutoff);

  for (const row of ancient ?? []) {
    await supabase
      .from("lf_enrichment_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        last_error: "Failed: retry window exceeded",
      })
      .eq("id", row.id)
      .eq("status", "retry");
  }
  if ((ancient ?? []).length > 0) {
    console.warn(
      `[lf-worker] Marked ${(ancient ?? []).length} ancient retry jobs as failed`
    );
  }
}

async function syncBatchStatuses(): Promise<void> {
  const supabase = createAdminClient();

  // Batches with no remaining active jobs → done
  const { data: openBatches } = await supabase
    .from("lf_enrichment_batches")
    .select("id, organization_id, campaign_id, total, status")
    .in("status", ["queued", "running"]);

  for (const batch of openBatches ?? []) {
    const { count: activeCount } = await supabase
      .from("lf_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .in("status", ["queued", "retry", "running"]);

    const { count: doneCount } = await supabase
      .from("lf_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .eq("status", "done");

    const { count: failedCount } = await supabase
      .from("lf_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .eq("status", "failed");

    if ((activeCount ?? 0) === 0) {
      await supabase
        .from("lf_enrichment_batches")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
        })
        .eq("id", batch.id)
        .in("status", ["queued", "running"]);
      leadEmitter.emit("enrichment-batch:updated", {
        batchId: batch.id,
        organizationId: batch.organization_id,
        campaignId: batch.campaign_id,
        total: batch.total,
        completed: doneCount ?? 0,
        failed: failedCount ?? 0,
        status: "done",
      });
    } else if (batch.status === "queued") {
      const { count: startedCount } = await supabase
        .from("lf_enrichment_jobs")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch.id)
        .in("status", ["running", "done", "failed"]);
      if ((startedCount ?? 0) > 0) {
        await supabase
          .from("lf_enrichment_batches")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
          })
          .eq("id", batch.id)
          .eq("status", "queued");
        leadEmitter.emit("enrichment-batch:updated", {
          batchId: batch.id,
          organizationId: batch.organization_id,
          campaignId: batch.campaign_id,
          total: batch.total,
          completed: doneCount ?? 0,
          failed: failedCount ?? 0,
          status: "running",
        });
      }
    }
  }
}

// =============================================================================
// Per-org concurrency resolution
// =============================================================================

async function resolveCampaignConcurrency(
  campaignId: string | null,
  orgId: string
): Promise<number> {
  if (!campaignId) return DEFAULT_CONCURRENCY;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lf_campaigns")
    .select("enrichment_concurrency")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  const raw = data?.enrichment_concurrency ?? DEFAULT_CONCURRENCY;
  return Math.min(
    Math.max(MIN_ENRICHMENT_CONCURRENCY, raw || DEFAULT_CONCURRENCY),
    MAX_ENRICHMENT_CONCURRENCY
  );
}

// =============================================================================
// Job claiming (single process, single-claim pass per lead per cycle)
// =============================================================================

export interface ClaimedJob {
  id: string;
  organization_id: string;
  batch_id: string;
  lead_id: string;
  actor_ids: unknown;
  attempts: number;
}

async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Select more candidates than requested so we can dedupe by lead_id
  const { data: candidates } = await supabase
    .from("lf_enrichment_jobs")
    .select("id, organization_id, batch_id, lead_id, actor_ids, attempts")
    .in("status", ["queued", "retry"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit * 3);

  if (!candidates || candidates.length === 0) return [];

  const seenLeads = new Set<string>();
  const picks: ClaimedJob[] = [];
  for (const row of candidates) {
    if (seenLeads.has(row.lead_id)) continue;
    seenLeads.add(row.lead_id);
    picks.push(row as ClaimedJob);
    if (picks.length >= limit) break;
  }

  // Overlapping cron invocations can race for the same rows: a job counts as
  // claimed only when this compare-and-swap actually matched it.
  const claimed: ClaimedJob[] = [];
  for (const row of picks) {
    const { data: won, error } = await supabase
      .from("lf_enrichment_jobs")
      .update({
        status: "running",
        started_at: nowIso,
      })
      .eq("id", row.id)
      .in("status", ["queued", "retry"])
      .select("id");
    if (!error && won && won.length > 0) claimed.push(row);
  }
  return claimed;
}

/**
 * Claims up to `limit` jobs, then keeps only as many per batch as the
 * campaign's concurrency allows. Jobs over the cap go back to `queued` so they
 * are not stranded in `running` until stale recovery.
 */
async function claimRunnableJobs(limit: number): Promise<ClaimedJob[]> {
  const claimed = await claimJobs(limit);
  if (claimed.length === 0) return [];

  const byBatch = new Map<string, ClaimedJob[]>();
  for (const j of claimed) {
    const key = `${j.organization_id}|${j.batch_id}`;
    const arr = byBatch.get(key) ?? [];
    arr.push(j);
    byBatch.set(key, arr);
  }

  const supabase = createAdminClient();
  const toRun: ClaimedJob[] = [];
  const overCap: string[] = [];
  for (const [, jobs] of byBatch.entries()) {
    const first = jobs[0];
    const { data: batch } = await supabase
      .from("lf_enrichment_batches")
      .select("campaign_id")
      .eq("id", first.batch_id)
      .limit(1)
      .maybeSingle();
    const cap = await resolveCampaignConcurrency(
      batch?.campaign_id ?? null,
      first.organization_id
    );
    toRun.push(...jobs.slice(0, cap));
    overCap.push(...jobs.slice(cap).map((j) => j.id));
  }

  if (overCap.length > 0) {
    await supabase
      .from("lf_enrichment_jobs")
      .update({ status: "queued" })
      .in("id", overCap)
      .eq("status", "running");
  }
  return toRun;
}

// =============================================================================
// Process a single claimed job
// =============================================================================

async function loadJobContext(
  job: ClaimedJob
): Promise<{
  campaignId: string | null;
  aiProvider: AIProvider;
  kpiDefinitions: KpiDefinition[];
  leadFieldDefinitions: LeadFieldDefinition[];
  enrichmentActors: string[];
} | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("lf_leads")
    .select("campaign_id, organization_id")
    .eq("id", job.lead_id)
    .eq("organization_id", job.organization_id)
    .limit(1)
    .maybeSingle();
  if (!lead) return null;

  const campaignId = lead.campaign_id;
  let aiProvider: AIProvider = "openrouter";
  let kpiDefinitions: KpiDefinition[] = [];
  let leadFieldDefinitions: LeadFieldDefinition[] = [];
  let campaignActors: string[] = [];

  if (campaignId) {
    const { data: campaign } = await supabase
      .from("lf_campaigns")
      .select(
        "ai_provider, kpi_definitions, lead_field_definitions, apify_actors"
      )
      .eq("id", campaignId)
      .eq("organization_id", job.organization_id)
      .limit(1)
      .maybeSingle();
    if (campaign) {
      aiProvider = (campaign.ai_provider as AIProvider) || "openrouter";
      kpiDefinitions =
        (campaign.kpi_definitions as KpiDefinition[] | null) ?? [];
      leadFieldDefinitions =
        (campaign.lead_field_definitions as LeadFieldDefinition[] | null) ??
        [];
      campaignActors = Array.isArray(campaign.apify_actors)
        ? (campaign.apify_actors as string[])
        : [];
    }
  }

  const jobActors = Array.isArray(job.actor_ids)
    ? (job.actor_ids as string[])
    : [];
  const enrichmentActors =
    jobActors.length > 0 ? jobActors : campaignActors;

  return {
    campaignId,
    aiProvider,
    kpiDefinitions,
    leadFieldDefinitions,
    enrichmentActors,
  };
}

async function failJob(
  job: ClaimedJob,
  newAttempts: number,
  reason: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("lf_enrichment_jobs")
    .update({
      status: "failed",
      attempts: newAttempts,
      last_error: reason.slice(0, 500),
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running");
}

async function retryJob(
  job: ClaimedJob,
  newAttempts: number,
  reason: string,
  delayMs: number
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("lf_enrichment_jobs")
    .update({
      status: "retry",
      attempts: newAttempts,
      next_attempt_at: addMs(withJitter(delayMs)),
      last_error: reason.slice(0, 500),
    })
    .eq("id", job.id)
    .eq("status", "running");
}

async function writeObsidianObservationForLead(
  orgId: string,
  leadId: string,
  campaignId: string
): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: lead }, { data: campaign }, { data: personalization }] =
    await Promise.all([
      supabase
        .from("lf_leads")
        .select("id, display_name, email, website, score")
        .eq("id", leadId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("lf_campaigns")
        .select("id, name, obsidian_sync_enabled")
        .eq("id", campaignId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("lf_lead_personalization")
        .select("pain_points, personalization_summary")
        .eq("lead_id", leadId)
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);

  if (!lead || lead.score === null || lead.score === undefined) return;

  // Respect per-campaign opt-out: org-level is already enforced inside the
  // observer, but campaigns may disable sync individually.
  if (campaign && campaign.obsidian_sync_enabled === false) return;

  const pain = Array.isArray(personalization?.pain_points)
    ? (personalization!.pain_points as string[])
    : [];

  await writeLeadObservation(orgId, {
    leadName: lead.display_name || "Unknown Lead",
    email: lead.email ?? null,
    website: lead.website ?? null,
    score: lead.score as number,
    painPoints: pain,
    personalizationSummary:
      (personalization?.personalization_summary as string | null) ?? "",
    campaignName: campaign?.name ?? null,
  });
}

/** `failed` is true when the job did not complete (failed or rescheduled for retry). */
export interface JobOutcome {
  rateLimited: boolean;
  failed: boolean;
}

async function processJob(
  job: ClaimedJob
): Promise<JobOutcome> {
  const ctx = await loadJobContext(job);
  if (!ctx) {
    await failJob(job, (job.attempts ?? 0) + 1, "Lead not found");
    return { rateLimited: false, failed: true };
  }

  if (!ctx.campaignId) {
    await failJob(
      job,
      (job.attempts ?? 0) + 1,
      "Lead has no campaign_id"
    );
    return { rateLimited: false, failed: true };
  }

  try {
    // The pipeline's compare-and-swap is the job's `done` write; if it did
    // not persist (job cancelled/finished meanwhile), stop here.
    const { persisted } = await enrichSingleLead(
      job.lead_id,
      ctx.campaignId,
      job.organization_id,
      {
        aiProvider: ctx.aiProvider,
        enrichmentActors: ctx.enrichmentActors,
        kpiDefinitions: ctx.kpiDefinitions,
        leadFieldDefinitions: ctx.leadFieldDefinitions,
        jobId: job.id,
      }
    );
    if (!persisted) return { rateLimited: false, failed: false };

    // Best-effort Obsidian observation write (no-ops when disabled/unconfigured).
    // Never fail the job if the vault write errors — the worker has already
    // persisted the enrichment results to Supabase at this point.
    try {
      await writeObsidianObservationForLead(
        job.organization_id,
        job.lead_id,
        ctx.campaignId
      );
    } catch (obsErr) {
      console.error(
        "[lf-worker] obsidian write failed (non-fatal):",
        obsErr
      );
    }

    return { rateLimited: false, failed: false };
  } catch (err) {
    const newAttempts = (job.attempts ?? 0) + 1;

    if (isApifyMemoryLimitError(err)) {
      pauseForApifyMemory();
      if (newAttempts >= MAX_ATTEMPTS) {
        await failJob(
          job,
          newAttempts,
          "Apify memory capacity exhausted repeatedly"
        );
      } else {
        await retryJob(
          job,
          newAttempts,
          "Apify memory capacity exhausted",
          Math.max(APIFY_MEMORY_PAUSE_MS, backoffMs(newAttempts))
        );
      }
      return { rateLimited: true, failed: true };
    }

    if (isRateLimitError(err)) {
      pauseForRateLimit();
      if (newAttempts >= MAX_ATTEMPTS) {
        await failJob(job, newAttempts, "Rate limited repeatedly");
      } else {
        await retryJob(
          job,
          newAttempts,
          "Rate limited",
          Math.max(RATE_LIMIT_PAUSE_MS, backoffMs(newAttempts))
        );
      }
      return { rateLimited: true, failed: true };
    }

    if (newAttempts >= MAX_ATTEMPTS) {
      await failJob(job, newAttempts, String(err));
      console.error(
        `[lf-worker] Job ${job.id} lead ${job.lead_id} permanently failed after ${newAttempts} attempts:`,
        err
      );
    } else {
      await retryJob(
        job,
        newAttempts,
        String(err),
        backoffMs(newAttempts)
      );
      console.warn(
        `[lf-worker] Job ${job.id} attempt ${newAttempts}/${MAX_ATTEMPTS} failed, retrying later`
      );
    }
    return { rateLimited: false, failed: true };
  }
}

function tuneConcurrencyAfterCycle(
  rateLimited: boolean,
  configuredMax: number
) {
  if (rateLimited) {
    g._lfEnrichStableCycles = 0;
    g._lfEnrichAdaptiveCap = Math.max(
      1,
      (g._lfEnrichAdaptiveCap ?? configuredMax) - 1
    );
    console.warn(
      `[lf-worker] Reduced adaptive concurrency cap to ${g._lfEnrichAdaptiveCap}`
    );
    return;
  }
  g._lfEnrichStableCycles = (g._lfEnrichStableCycles ?? 0) + 1;
  if (
    (g._lfEnrichStableCycles ?? 0) >= 10 &&
    (g._lfEnrichAdaptiveCap ?? configuredMax) < configuredMax
  ) {
    g._lfEnrichAdaptiveCap = (g._lfEnrichAdaptiveCap ?? configuredMax) + 1;
    g._lfEnrichStableCycles = 0;
    console.log(
      `[lf-worker] Increased adaptive concurrency cap to ${g._lfEnrichAdaptiveCap}`
    );
  }
}

// =============================================================================
// Bounded drain (serverless-safe)
// =============================================================================

export interface DrainOptions {
  /** Stop once this many jobs have been processed. */
  maxJobs: number;
  /** Do not start a new cycle once this many ms have elapsed. */
  deadlineMs: number;
}

export interface DrainResult {
  /** Jobs claimed and run to an outcome during this drain. */
  processed: number;
  /** Of those, jobs that did not complete (failed or rescheduled for retry). */
  failed: number;
  /** Jobs still waiting in `queued`/`retry` after the drain. */
  remaining: number;
}

/** Injectable collaborators (tests pass fakes; production uses the DB). */
export interface DrainDeps {
  claim: (limit: number) => Promise<ClaimedJob[]>;
  process: (job: ClaimedJob) => Promise<JobOutcome>;
  countRemaining: () => Promise<number>;
  /** Queue hygiene, run once before the first cycle. */
  prepare: () => Promise<void>;
  /** Runs after every cycle (batch status sync). */
  afterCycle: () => Promise<void>;
  isPaused: () => boolean;
  now: () => number;
}

async function countRemainingJobs(): Promise<number> {
  const { count } = await createAdminClient()
    .from("lf_enrichment_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "retry"]);
  return count ?? 0;
}

async function prepareQueue(): Promise<void> {
  await recoverStaleRunning();
  await failAncientRetryJobs();
  await syncBatchStatuses();
}

const defaultDrainDeps: DrainDeps = {
  claim: claimRunnableJobs,
  process: processJob,
  countRemaining: countRemainingJobs,
  prepare: prepareQueue,
  afterCycle: syncBatchStatuses,
  isPaused,
  now: () => Date.now(),
};

/**
 * Claims and processes queued/retry jobs in awaited cycles until `maxJobs`
 * have been processed, the deadline passes, the queue is empty, or this
 * instance is cooling down after a rate/memory limit. Every started job is
 * awaited before returning, so nothing is left running after the response.
 */
export async function drainEnrichmentJobs(
  opts: DrainOptions,
  deps: Partial<DrainDeps> = {}
): Promise<DrainResult> {
  const d: DrainDeps = { ...defaultDrainDeps, ...deps };
  const startedAt = d.now();
  let processed = 0;
  let failed = 0;

  await d.prepare();

  while (
    processed < opts.maxJobs &&
    d.now() - startedAt < opts.deadlineMs &&
    !d.isPaused()
  ) {
    const cap = Math.min(
      MAX_ENRICHMENT_CONCURRENCY,
      Math.max(1, g._lfEnrichAdaptiveCap ?? DEFAULT_CONCURRENCY)
    );
    const claimed = await d.claim(Math.min(cap, opts.maxJobs - processed));
    if (claimed.length === 0) break;

    const results = await Promise.allSettled(claimed.map((j) => d.process(j)));
    processed += claimed.length;
    failed += results.filter(
      (r) => r.status === "rejected" || r.value.failed
    ).length;
    tuneConcurrencyAfterCycle(
      results.some((r) => r.status === "fulfilled" && r.value.rateLimited),
      DEFAULT_CONCURRENCY
    );
    await d.afterCycle();
  }

  return { processed, failed, remaining: await d.countRemaining() };
}

// =============================================================================
// Dev-only background loop
// =============================================================================

/**
 * Local/dev convenience (booted by instrumentation.ts): keeps draining in a
 * long-lived `next dev` process. A no-op in production, where the
 * lead-finder-worker cron drains in bounded, awaited batches instead.
 */
export function workerPump(): void {
  if (process.env.NODE_ENV === "production") return;
  if (g._lfEnrichWorkerRunning) return;
  g._lfEnrichWorkerRunning = true;
  console.log("[lf-worker] Starting dev enrichment loop");

  void (async () => {
    try {
      while (true) {
        const { processed } = await drainEnrichmentJobs({
          maxJobs: 50,
          deadlineMs: 60_000,
        });
        if (processed === 0) await sleep(DEV_IDLE_MS);
      }
    } catch (err) {
      console.error("[lf-worker] Dev enrichment loop stopped:", err);
    } finally {
      g._lfEnrichWorkerRunning = false;
    }
  })();
}
