/**
 * Durable background enrichment worker (Pulse CRM parity with lead-finder).
 *
 * - Reads jobs from `lf_enrichment_jobs` (status in "queued"|"retry") across all orgs
 * - Runs enrichSingleLead() per claimed job, respecting per-org campaign concurrency
 * - On success: status="done"
 * - On failure: exponential backoff retry up to MAX_ATTEMPTS, then status="failed"
 * - On 429 / memory limit: pauses global loop for a cooling window
 * - Survives HMR reloads (singleton stored on globalThis)
 * - Must be kicked via workerPump() on enqueue; also started by instrumentation on boot
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

const POLL_IDLE_MS = 500;
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
// HMR-safe singleton state
// =============================================================================

const g = globalThis as unknown as {
  _lfEnrichWorkerRunning?: boolean;
  _lfEnrichWorkerPauseUntil?: number;
  _lfEnrichAdaptiveCap?: number;
  _lfEnrichStableCycles?: number;
  _lfEnrichWorkerRestartAttempts?: number;
  _lfEnrichWorkerRestartTimer?: ReturnType<typeof setTimeout>;
  _lfEnrichLastHygieneAt?: number;
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

interface ClaimedJob {
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

  const claimed: ClaimedJob[] = [];
  for (const row of picks) {
    const { error } = await supabase
      .from("lf_enrichment_jobs")
      .update({
        status: "running",
        started_at: nowIso,
      })
      .eq("id", row.id)
      .in("status", ["queued", "retry"]);
    if (!error) claimed.push(row);
  }
  return claimed;
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
    .eq("id", job.id);
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
    .eq("id", job.id);
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

async function processJob(
  job: ClaimedJob
): Promise<{ rateLimited: boolean }> {
  const supabase = createAdminClient();
  const ctx = await loadJobContext(job);
  if (!ctx) {
    await failJob(job, (job.attempts ?? 0) + 1, "Lead not found");
    return { rateLimited: false };
  }

  if (!ctx.campaignId) {
    await failJob(
      job,
      (job.attempts ?? 0) + 1,
      "Lead has no campaign_id"
    );
    return { rateLimited: false };
  }

  try {
    await enrichSingleLead(job.lead_id, ctx.campaignId, job.organization_id, {
      aiProvider: ctx.aiProvider,
      enrichmentActors: ctx.enrichmentActors,
      kpiDefinitions: ctx.kpiDefinitions,
      leadFieldDefinitions: ctx.leadFieldDefinitions,
    });

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

    await supabase
      .from("lf_enrichment_jobs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { rateLimited: false };
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
      return { rateLimited: true };
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
      return { rateLimited: true };
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
    return { rateLimited: false };
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
// Main loop
// =============================================================================

async function workerLoop(): Promise<void> {
  while (true) {
    if (
      !g._lfEnrichLastHygieneAt ||
      Date.now() - g._lfEnrichLastHygieneAt > 30_000
    ) {
      await recoverStaleRunning();
      await failAncientRetryJobs();
      await syncBatchStatuses();
      g._lfEnrichLastHygieneAt = Date.now();
    }

    if (isPaused()) {
      await sleep(POLL_IDLE_MS);
      continue;
    }

    if (g._lfEnrichAdaptiveCap == null) {
      g._lfEnrichAdaptiveCap = DEFAULT_CONCURRENCY;
    }
    const claimed = await claimJobs(
      Math.min(
        MAX_ENRICHMENT_CONCURRENCY,
        Math.max(1, g._lfEnrichAdaptiveCap)
      )
    );

    if (claimed.length === 0) {
      await syncBatchStatuses();
      await sleep(POLL_IDLE_MS);
      continue;
    }

    // Resolve per-campaign concurrency and cap claimed jobs accordingly.
    const byCampaign = new Map<string, ClaimedJob[]>();
    for (const j of claimed) {
      const key = `${j.organization_id}|${j.batch_id}`;
      const arr = byCampaign.get(key) ?? [];
      arr.push(j);
      byCampaign.set(key, arr);
    }

    const toRun: ClaimedJob[] = [];
    for (const [, jobs] of byCampaign.entries()) {
      const first = jobs[0];
      const supabase = createAdminClient();
      const { data: batch } = await supabase
        .from("lf_enrichment_batches")
        .select("campaign_id")
        .eq("id", first.batch_id)
        .limit(1)
        .maybeSingle();
      const campId = batch?.campaign_id ?? null;
      const cap = await resolveCampaignConcurrency(
        campId,
        first.organization_id
      );
      toRun.push(...jobs.slice(0, cap));
    }

    const results = await Promise.allSettled(toRun.map(processJob));
    const hadRateLimit = results.some(
      (r) => r.status === "fulfilled" && r.value.rateLimited
    );
    tuneConcurrencyAfterCycle(hadRateLimit, DEFAULT_CONCURRENCY);
    await syncBatchStatuses();
  }
}

// =============================================================================
// Public: start the worker (idempotent, HMR-safe)
// =============================================================================

export function workerPump(): void {
  if (g._lfEnrichWorkerRunning) return;
  if (g._lfEnrichWorkerRestartTimer) {
    clearTimeout(g._lfEnrichWorkerRestartTimer);
    g._lfEnrichWorkerRestartTimer = undefined;
  }
  g._lfEnrichWorkerRunning = true;
  g._lfEnrichWorkerRestartAttempts = 0;
  console.log("[lf-worker] Starting Lead Finder enrichment worker");

  const restart = (delayMs: number) => {
    if (g._lfEnrichWorkerRestartTimer) {
      clearTimeout(g._lfEnrichWorkerRestartTimer);
    }
    g._lfEnrichWorkerRestartTimer = setTimeout(() => {
      g._lfEnrichWorkerRestartTimer = undefined;
      if (!g._lfEnrichWorkerRunning) workerPump();
    }, delayMs);
  };

  workerLoop()
    .then(() => {
      console.warn(
        "[lf-worker] Worker loop exited unexpectedly — restarting"
      );
      g._lfEnrichWorkerRunning = false;
      restart(2000);
    })
    .catch((err) => {
      console.error("[lf-worker] Fatal error — worker stopped:", err);
      g._lfEnrichWorkerRunning = false;
      g._lfEnrichWorkerRestartAttempts =
        (g._lfEnrichWorkerRestartAttempts ?? 0) + 1;
      const delay = Math.min(
        30_000,
        2_000 * Math.pow(2, g._lfEnrichWorkerRestartAttempts - 1)
      );
      console.warn(
        `[lf-worker] Scheduling auto-restart in ${Math.round(delay / 1000)}s`
      );
      restart(delay);
    });
}
