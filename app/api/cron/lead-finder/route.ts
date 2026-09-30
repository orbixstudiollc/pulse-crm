import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ingestDiscoveredItems,
  startDiscoveryRun,
} from "@/lib/lead-finder/apify/discovery";
import { authorizeActors } from "@/lib/lead-finder/apify/policy-server";
import { ACTOR_REGISTRY } from "@/lib/lead-finder/apify/registry";
import {
  fetchDatasetItems,
  getRunStatus,
  type RunStatus,
} from "@/lib/lead-finder/apify/runner";
import { enrichCampaignLeads } from "@/lib/lead-finder/enrichment/pipeline";
import type { LFCampaign } from "@/lib/lead-finder/types";
import { verifyCronRequest } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

// Finalising asynchronous discovery runs (started by the discover route)
const MAX_RUNS_PER_TICK = 10;
const RUN_CANDIDATE_SCAN = 50;
const MIN_RUN_AGE_MS = 10_000;
const RUN_TIMEOUT_MS = 45 * 60_000;
// An ingest lease (finished_at set while status is running) older than this is stale.
const LEASE_MS = 10 * 60_000;
// Stop starting new finalisations after this much of the 300 s budget is spent.
const FINALIZE_BUDGET_MS = 200_000;

export async function GET(req: NextRequest) {
  const authErr = verifyCronRequest(req);
  if (authErr) return authErr;

  const startedAt = Date.now();
  try {

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Finalise running discovery runs first so scheduled discovery can't starve it.
    const finalized = await finalizeDiscoveryRuns(supabase, startedAt);

    // Find active campaigns with scheduled discovery that are due
    const { data: campaigns, error } = await supabase
      .from("lf_campaigns")
      .select("*")
      .eq("status", "active")
      .neq("schedule_frequency", "once")
      .lte("next_discovery_at", now);

    if (error) {
      console.error("[cron/lead-finder] fetch campaigns failed", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        message: "No campaigns due for discovery",
        processed: 0,
        finalized,
      });
    }

    const results: {
      campaignId: string;
      name: string;
      discovery: ScheduledDiscovery | null;
      error?: string;
    }[] = [];

    for (const rawCampaign of campaigns) {
      const campaign = rawCampaign as unknown as LFCampaign;
      const actors = campaign.apify_actors ?? [];

      if (actors.length === 0) continue;

      try {
        // Start find-phase runs asynchronously; finalizeDiscoveryRuns ingests
        // them (and auto-enriches) on later cron calls.
        const discovery = await startScheduledDiscovery(supabase, campaign);
        if (!discovery) continue;

        // Calculate next discovery time
        const nextDiscoveryAt = calculateNextDiscovery(
          campaign.schedule_frequency
        );

        // Update campaign with next run time
        await supabase
          .from("lf_campaigns")
          .update({
            next_discovery_at: nextDiscoveryAt,
            last_discovery_at: now,
            updated_at: now,
          })
          .eq("id", campaign.id);

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          discovery,
        });
      } catch (err) {
        console.error(
          `[cron/lead-finder] campaign ${campaign.id} failed`,
          err
        );
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          discovery: null,
          error: "Campaign run failed",
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} campaigns`,
      processed: results.length,
      results,
      finalized,
    });
  } catch (err) {
    console.error("[cron/lead-finder] unexpected error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// =============================================================================
// Discovery run finalisation
// =============================================================================

type AdminClient = ReturnType<typeof createAdminClient>;

type RunRow = {
  id: string;
  organization_id: string;
  campaign_id: string;
  actor_id: string;
  run_id: string;
  started_at: string;
};

type FinalizeOutcome = {
  id: string;
  status: "running" | "succeeded" | "failed";
  inserted?: number;
  error?: string;
};

type DiscoveryCheck = (actorId: string, orgId: string) => Promise<boolean>;

/**
 * Finalise running discovery runs (find-phase actors only; enrichment runs are
 * polled by their own pipeline):
 * 1. Runs older than RUN_TIMEOUT_MS are marked failed before any Apify call,
 *    so a removed token or an unknown run id cannot keep a run open forever.
 * 2. Up to RUN_CANDIDATE_SCAN candidates are checked round-robin by
 *    organization, so one tenant cannot starve the others. Only runs that
 *    reach succeeded/failed count towards MAX_RUNS_PER_TICK.
 * 3. A finished run is leased (finished_at set, status still running),
 *    ingested, and only then marked succeeded. A transient error releases the
 *    lease so the next tick retries.
 * No run is started once FINALIZE_BUDGET_MS has elapsed since `startedAt`.
 */
async function finalizeDiscoveryRuns(
  supabase: AdminClient,
  startedAt: number
): Promise<FinalizeOutcome[]> {
  const isDiscovery = discoveryActorCheck(supabase);
  const outcomes = await failTimedOutRuns(supabase, isDiscovery);

  const now = Date.now();
  const { data, error } = await runningRunsQuery(supabase)
    .neq("run_id", "")
    .lte("started_at", new Date(now - MIN_RUN_AGE_MS).toISOString())
    .or(leaseFreeFilter(now))
    .order("started_at", { ascending: true })
    .limit(RUN_CANDIDATE_SCAN);

  if (error) {
    console.error("[cron/lead-finder] fetch running runs failed", error);
    return outcomes;
  }

  const runs: RunRow[] = [];
  for (const run of (data ?? []) as RunRow[]) {
    if (await isDiscovery(run.actor_id, run.organization_id)) runs.push(run);
  }

  let finalized = 0;
  for (const run of roundRobinByOrg(runs)) {
    if (finalized >= MAX_RUNS_PER_TICK) break;
    if (Date.now() - startedAt > FINALIZE_BUDGET_MS) break;
    try {
      const outcome = await finalizeRun(supabase, run);
      if (outcome.status !== "running") finalized++;
      outcomes.push(outcome);
    } catch (err) {
      // Unexpected (e.g. DB unreachable): leave it running; the timeout catches it.
      console.error(`[cron/lead-finder] finalize run ${run.id} failed`, err);
      outcomes.push({ id: run.id, status: "running", error: errorMessage(err) });
    }
  }
  return outcomes;
}

/** Running, campaign-scoped runs, excluding built-in enrich-phase actors. */
function runningRunsQuery(supabase: AdminClient) {
  const enrichActorList = `(${ACTOR_REGISTRY.filter((a) => a.phase !== "find")
    .map((a) => `"${a.id}"`)
    .join(",")})`;
  return supabase
    .from("lf_apify_runs")
    .select("id, organization_id, campaign_id, actor_id, run_id, started_at")
    .eq("status", "running")
    .not("campaign_id", "is", null)
    .not("actor_id", "in", enrichActorList);
}

/** PostgREST `or` filter: no ingest lease, or a stale one (older than LEASE_MS). */
function leaseFreeFilter(now: number): string {
  const staleBefore = new Date(now - LEASE_MS).toISOString();
  return `finished_at.is.null,finished_at.lt."${staleBefore}"`;
}

/**
 * Mark running find-phase runs older than RUN_TIMEOUT_MS as failed without
 * calling Apify. Runs holding an active ingest lease are left alone.
 */
async function failTimedOutRuns(
  supabase: AdminClient,
  isDiscovery: DiscoveryCheck
): Promise<FinalizeOutcome[]> {
  const now = Date.now();
  const { data, error } = await runningRunsQuery(supabase)
    .lt("started_at", new Date(now - RUN_TIMEOUT_MS).toISOString())
    .or(leaseFreeFilter(now))
    .order("started_at", { ascending: true })
    .limit(RUN_CANDIDATE_SCAN);

  if (error) {
    console.error("[cron/lead-finder] fetch timed-out runs failed", error);
    return [];
  }

  const expired: RunRow[] = [];
  for (const run of (data ?? []) as RunRow[]) {
    if (await isDiscovery(run.actor_id, run.organization_id)) expired.push(run);
  }
  if (expired.length === 0) return [];

  const { data: updated, error: updateErr } = await supabase
    .from("lf_apify_runs")
    .update({ status: "failed", finished_at: new Date().toISOString() })
    .in("id", expired.map((r) => r.id))
    .eq("status", "running")
    .or(leaseFreeFilter(now))
    .select("id");

  if (updateErr) {
    console.error("[cron/lead-finder] fail timed-out runs failed", updateErr);
    return [];
  }

  const failedIds = new Set((updated ?? []).map((r) => r.id));
  return expired
    .filter((run) => failedIds.has(run.id))
    .map((run) => {
      console.error(
        `[cron/lead-finder] discovery run ${run.id} (apify ${run.run_id}) failed: timed out`
      );
      return { id: run.id, status: "failed" as const, error: "timed out" };
    });
}

/** Interleave runs by organization: each org's oldest run, then its second, ... */
function roundRobinByOrg(runs: RunRow[]): RunRow[] {
  const byOrg = new Map<string, RunRow[]>();
  for (const run of runs) {
    byOrg.set(run.organization_id, [...(byOrg.get(run.organization_id) ?? []), run]);
  }
  const queues = [...byOrg.values()];
  const longest = Math.max(0, ...queues.map((q) => q.length));
  const ordered: RunRow[] = [];
  for (let i = 0; i < longest; i++) {
    for (const queue of queues) {
      if (i < queue.length) ordered.push(queue[i]);
    }
  }
  return ordered;
}

/** isDiscoveryActor, memoised for one cron tick. */
function discoveryActorCheck(supabase: AdminClient): DiscoveryCheck {
  const cache = new Map<string, Promise<boolean>>();
  return (actorId, orgId) => {
    const key = `${orgId}:${actorId}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const result = isDiscoveryActor(supabase, actorId, orgId);
    cache.set(key, result);
    return result;
  };
}

async function isDiscoveryActor(
  supabase: AdminClient,
  actorId: string,
  orgId: string
): Promise<boolean> {
  const builtin = ACTOR_REGISTRY.find((a) => a.id === actorId);
  if (builtin) return builtin.phase === "find";
  const { data } = await supabase
    .from("lf_custom_actors")
    .select("phase")
    .eq("organization_id", orgId)
    .eq("actor_id", actorId)
    .limit(1)
    .maybeSingle();
  return data?.phase === "find";
}

function isTimedOut(run: RunRow): boolean {
  return Date.now() - new Date(run.started_at).getTime() > RUN_TIMEOUT_MS;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

async function finalizeRun(
  supabase: AdminClient,
  run: RunRow
): Promise<FinalizeOutcome> {
  let status: RunStatus;
  try {
    const { token } = await authorizeActors(run.organization_id, []);
    status = await getRunStatus(run.run_id, token);
  } catch (err) {
    // Token removed, run id unknown to the current Apify account (401/404), or
    // Apify unreachable: retry next tick unless the run has timed out.
    const message = errorMessage(err);
    if (!isTimedOut(run)) return { id: run.id, status: "running", error: message };
    await markRunFailed(supabase, run, message);
    return { id: run.id, status: "failed", error: message };
  }

  if (status.status === "running") {
    if (!isTimedOut(run)) return { id: run.id, status: "running" };
    await markRunFailed(supabase, run, "timed out");
    return { id: run.id, status: "failed", error: "timed out" };
  }

  if (status.status === "failed") {
    const reason = status.error ?? "Actor run failed";
    await markRunFailed(supabase, run, reason);
    return { id: run.id, status: "failed", error: reason };
  }

  // Lease the run so a concurrent invocation cannot ingest it twice. Status
  // stays "running" until ingest completes, so a failed ingest is retried.
  const leaseAt = Date.now();
  const { data: claimed, error: claimErr } = await supabase
    .from("lf_apify_runs")
    .update({
      finished_at: new Date(leaseAt).toISOString(),
      dataset_id: status.datasetId ?? null,
      cost_usd: status.costUsd ?? null,
    })
    .eq("id", run.id)
    .eq("status", "running")
    .or(leaseFreeFilter(leaseAt))
    .select("id");
  if (claimErr) throw claimErr;
  if (!claimed || claimed.length === 0) {
    return { id: run.id, status: "running" }; // leased by another invocation
  }

  let counts: Awaited<ReturnType<typeof ingestDiscoveredItems>>;
  try {
    const items = status.datasetId
      ? await fetchDatasetItems(status.datasetId, run.organization_id)
      : [];
    counts = await ingestDiscoveredItems(
      items,
      {
        actorId: run.actor_id,
        campaignId: run.campaign_id,
        orgId: run.organization_id,
        dbId: run.id,
        costUsd: status.costUsd,
      },
      supabase
    );
  } catch (err) {
    const message = errorMessage(err);
    if (isTimedOut(run)) {
      await markRunFailed(supabase, run, message);
      return { id: run.id, status: "failed", error: message };
    }
    // Transient: release the lease so the next tick retries the ingest.
    console.error(
      `[cron/lead-finder] ingest of run ${run.id} failed, will retry: ${message}`
    );
    await supabase
      .from("lf_apify_runs")
      .update({ finished_at: null })
      .eq("id", run.id)
      .eq("status", "running");
    return { id: run.id, status: "running", error: message };
  }

  await supabase
    .from("lf_apify_runs")
    .update({
      status: "succeeded",
      result_count: counts.totalResults,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "running");
  await supabase
    .from("lf_campaigns")
    .update({ last_discovery_at: new Date().toISOString() })
    .eq("id", run.campaign_id)
    .eq("organization_id", run.organization_id);

  if (counts.inserted > 0) {
    await autoEnrichIfEnabled(supabase, run);
  }

  return { id: run.id, status: "succeeded", inserted: counts.inserted };
}

/** lf_apify_runs has no error column, so the reason is logged. */
async function markRunFailed(
  supabase: AdminClient,
  run: RunRow,
  reason: string
): Promise<void> {
  console.error(
    `[cron/lead-finder] discovery run ${run.id} (apify ${run.run_id}) failed: ${reason}`
  );
  await supabase
    .from("lf_apify_runs")
    .update({ status: "failed", finished_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", "running");
}

async function autoEnrichIfEnabled(
  supabase: AdminClient,
  run: RunRow
): Promise<void> {
  try {
    const { data: campaign } = await supabase
      .from("lf_campaigns")
      .select("auto_enrich")
      .eq("id", run.campaign_id)
      .eq("organization_id", run.organization_id)
      .maybeSingle();
    if (campaign?.auto_enrich) {
      await enrichCampaignLeads(run.campaign_id, run.organization_id);
    }
  } catch (err) {
    console.error(`[cron/lead-finder] auto-enrich after run ${run.id} failed`, err);
  }
}

// =============================================================================
// Scheduled discovery (asynchronous, service-role)
// =============================================================================

type ScheduledDiscovery = { runIds: string[]; failed: number };

/**
 * Start one Apify run per find-phase actor of a due campaign, with the admin
 * client (a cron request has no user session). Returns null when the campaign
 * has no find-phase actors. Start failures are logged and counted, not thrown,
 * so the caller still advances the schedule instead of restarting runs every tick.
 */
async function startScheduledDiscovery(
  supabase: AdminClient,
  campaign: LFCampaign
): Promise<ScheduledDiscovery | null> {
  const orgId = campaign.organization_id;
  const findActors: string[] = [];
  for (const actorId of campaign.apify_actors ?? []) {
    if (await isDiscoveryActor(supabase, actorId, orgId)) {
      findActors.push(actorId);
    }
  }
  if (findActors.length === 0) return null;

  let token: string;
  try {
    token = (await authorizeActors(orgId, findActors)).token;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apify is not configured";
    console.error(`[cron/lead-finder] campaign ${campaign.id}: ${message}`);
    return { runIds: [], failed: findActors.length };
  }

  const actorConfigs = campaign.actor_configs ?? {};
  const maxPages =
    campaign.max_pages_per_search > 0 ? campaign.max_pages_per_search : undefined;

  const runIds: string[] = [];
  let failed = 0;
  for (const actorId of findActors) {
    try {
      const { runId } = await startDiscoveryRun(
        {
          actorId,
          input: actorConfigs[actorId] ?? {},
          campaignId: campaign.id,
          orgId,
          token,
          maxPages,
        },
        supabase
      );
      runIds.push(runId);
    } catch (err) {
      console.error(
        `[cron/lead-finder] campaign ${campaign.id} start ${actorId} failed`,
        err
      );
      failed++;
    }
  }
  return { runIds, failed };
}

function calculateNextDiscovery(
  frequency: "once" | "daily" | "weekly"
): string {
  const next = new Date();
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    default:
      // 'once' should not reach here, but set far future
      next.setFullYear(next.getFullYear() + 100);
      break;
  }
  return next.toISOString();
}
