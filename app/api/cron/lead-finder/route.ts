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

export async function GET(req: NextRequest) {
  const authErr = verifyCronRequest(req);
  if (authErr) return authErr;

  try {

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Finalise running discovery runs first so scheduled discovery can't starve it.
    const finalized = await finalizeDiscoveryRuns(supabase);

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

/**
 * Check running discovery runs (find-phase actors only; enrichment runs are
 * polled by their own pipeline) and ingest the results of the finished ones.
 * Bounded to MAX_RUNS_PER_TICK runs per invocation.
 */
async function finalizeDiscoveryRuns(
  supabase: AdminClient
): Promise<FinalizeOutcome[]> {
  const cutoff = new Date(Date.now() - MIN_RUN_AGE_MS).toISOString();
  const enrichActorList = `(${ACTOR_REGISTRY.filter((a) => a.phase !== "find")
    .map((a) => `"${a.id}"`)
    .join(",")})`;
  const { data, error } = await supabase
    .from("lf_apify_runs")
    .select("id, organization_id, campaign_id, actor_id, run_id, started_at")
    .eq("status", "running")
    .not("campaign_id", "is", null)
    .not("actor_id", "in", enrichActorList)
    .neq("run_id", "")
    .lte("started_at", cutoff)
    .order("started_at", { ascending: true })
    .limit(RUN_CANDIDATE_SCAN);

  if (error) {
    console.error("[cron/lead-finder] fetch running runs failed", error);
    return [];
  }

  const candidates = (data ?? []) as RunRow[];
  const runs: RunRow[] = [];
  for (const run of candidates) {
    if (runs.length >= MAX_RUNS_PER_TICK) break;
    if (await isDiscoveryActor(supabase, run.actor_id, run.organization_id)) {
      runs.push(run);
    }
  }

  const outcomes: FinalizeOutcome[] = [];
  for (const run of runs) {
    try {
      outcomes.push(await finalizeRun(supabase, run));
    } catch (err) {
      // Transient (e.g. Apify unreachable): leave it running; the timeout catches it.
      console.error(`[cron/lead-finder] finalize run ${run.id} failed`, err);
      outcomes.push({
        id: run.id,
        status: "running",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return outcomes;
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

async function finalizeRun(
  supabase: AdminClient,
  run: RunRow
): Promise<FinalizeOutcome> {
  const { token } = await authorizeActors(run.organization_id, []);
  const status = await getRunStatus(run.run_id, token);

  if (status.status === "running") {
    const age = Date.now() - new Date(run.started_at).getTime();
    if (age <= RUN_TIMEOUT_MS) return { id: run.id, status: "running" };
    await markRunFailed(supabase, run, "timed out");
    return { id: run.id, status: "failed", error: "timed out" };
  }

  if (status.status === "failed") {
    await markRunFailed(supabase, run, status.error ?? "Actor run failed");
    return { id: run.id, status: "failed", error: status.error };
  }

  // Claim the run so a concurrent invocation cannot ingest it twice.
  const { data: claimed } = await supabase
    .from("lf_apify_runs")
    .update({
      status: "succeeded",
      dataset_id: status.datasetId ?? null,
      cost_usd: status.costUsd ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "running")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { id: run.id, status: "succeeded", inserted: 0 };
  }

  try {
    const items = status.datasetId
      ? await fetchDatasetItems(status.datasetId, run.organization_id)
      : [];
    const counts = await ingestDiscoveredItems(
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

    await supabase
      .from("lf_apify_runs")
      .update({ result_count: counts.totalResults })
      .eq("id", run.id);
    await supabase
      .from("lf_campaigns")
      .update({ last_discovery_at: new Date().toISOString() })
      .eq("id", run.campaign_id)
      .eq("organization_id", run.organization_id);

    if (counts.inserted > 0) {
      await autoEnrichIfEnabled(supabase, run);
    }

    return { id: run.id, status: "succeeded", inserted: counts.inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await markRunFailed(supabase, run, message);
    return { id: run.id, status: "failed", error: message };
  }
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
    .eq("id", run.id);
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
