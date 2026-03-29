import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { getApifyToken } from "../ai-provider";

// =============================================================================
// Apify Runner – starts actor runs, polls, and fetches results
// =============================================================================

const APIFY_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 360; // ~30 min

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export class ApifyError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorType?: string
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

export function parseApifyError(body: string, statusCode: number): ApifyError {
  try {
    const parsed = JSON.parse(body);
    return new ApifyError(
      parsed?.error?.message || parsed?.message || body,
      statusCode,
      parsed?.error?.type || "UNKNOWN"
    );
  } catch {
    return new ApifyError(body, statusCode, "UNKNOWN");
  }
}

// ---------------------------------------------------------------------------
// Start an actor run
// ---------------------------------------------------------------------------

export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
  orgId: string,
  campaignId?: string
): Promise<{ runId: string; dbId: string }> {
  const token = await getApifyToken(orgId);
  const supabase = createAdminClient();

  // Insert DB record first
  const runInsert = {
      organization_id: orgId,
      campaign_id: campaignId ?? null,
      actor_id: actorId,
      run_id: "", // filled after Apify responds
      status: "running",
      input_params: input,
      result_count: 0,
      started_at: new Date().toISOString(),
    };
  const { data: dbRow, error: dbErr } = await supabase
    .from("lf_apify_runs")
    .insert(runInsert as never)
    .select("id")
    .single();

  if (dbErr || !dbRow) {
    throw new Error(`Failed to create apify run record: ${dbErr?.message}`);
  }

  // Call Apify
  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    await supabase
      .from("lf_apify_runs")
      .update({ status: "failed" })
      .eq("id", dbRow.id);
    throw parseApifyError(body, res.status);
  }

  const json = await res.json();
  const apifyRunId: string = json.data?.id;

  // Update DB with the actual run ID
  await supabase
    .from("lf_apify_runs")
    .update({ run_id: apifyRunId })
    .eq("id", dbRow.id);

  return { runId: apifyRunId, dbId: dbRow.id };
}

// ---------------------------------------------------------------------------
// Poll until run finishes
// ---------------------------------------------------------------------------

export async function pollRunUntilDone(
  runId: string,
  orgId: string,
  dbId?: string
): Promise<{
  status: "succeeded" | "failed";
  datasetId: string | null;
  costUsd: number | null;
}> {
  const token = await getApifyToken(orgId);
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    );

    if (!res.ok) {
      throw new ApifyError(`Failed to poll run ${runId}: ${res.status}`);
    }

    const json = await res.json();
    const apifyStatus: string = json.data?.status;

    if (apifyStatus === "SUCCEEDED") {
      const datasetId = json.data?.defaultDatasetId ?? null;
      const costUsd = json.data?.usageTotalUsd ?? null;

      if (dbId) {
        await supabase
          .from("lf_apify_runs")
          .update({
            status: "succeeded",
            dataset_id: datasetId,
            cost_usd: costUsd,
            finished_at: new Date().toISOString(),
          })
          .eq("id", dbId);
      }

      return { status: "succeeded", datasetId, costUsd };
    }

    if (
      apifyStatus === "FAILED" ||
      apifyStatus === "ABORTED" ||
      apifyStatus === "TIMED-OUT"
    ) {
      const msg =
        json.data?.statusMessage || `Actor run ${apifyStatus}`;

      if (dbId) {
        await supabase
          .from("lf_apify_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
          })
          .eq("id", dbId);
      }

      throw new ApifyError(msg, undefined, apifyStatus);
    }

    // Still running – wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new ApifyError("Run polling timed out after 30 minutes");
}

// ---------------------------------------------------------------------------
// Fetch dataset items
// ---------------------------------------------------------------------------

export async function fetchDatasetItems(
  datasetId: string,
  orgId: string,
  limit = 1000
): Promise<Record<string, unknown>[]> {
  const token = await getApifyToken(orgId);

  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${limit}&format=json`
  );

  if (!res.ok) {
    throw new ApifyError(
      `Failed to fetch dataset ${datasetId}: ${res.status}`
    );
  }

  return (await res.json()) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Convenience: run actor → poll → fetch
// ---------------------------------------------------------------------------

export async function runActorAndCollect(
  actorId: string,
  input: Record<string, unknown>,
  orgId: string,
  campaignId?: string,
  itemLimit = 1000
): Promise<{
  items: Record<string, unknown>[];
  runId: string;
  dbId: string;
  costUsd: number | null;
}> {
  const { runId, dbId } = await startActorRun(
    actorId,
    input,
    orgId,
    campaignId
  );

  const result = await pollRunUntilDone(runId, orgId, dbId);

  let items: Record<string, unknown>[] = [];
  if (result.datasetId) {
    items = await fetchDatasetItems(result.datasetId, orgId, itemLimit);

    // Update result count
    const supabase = createAdminClient();
    await supabase
      .from("lf_apify_runs")
      .update({ result_count: items.length })
      .eq("id", dbId);
  }

  return {
    items,
    runId,
    dbId,
    costUsd: result.costUsd,
  };
}
