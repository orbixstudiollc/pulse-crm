import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { authorizeActors } from "./policy-server";

// =============================================================================
// Apify Runner – starts actor runs, polls, and fetches results
// =============================================================================

const APIFY_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 360; // ~30 min

/** errorType of the ApifyError thrown when a caller's `maxWaitMs` budget runs out. */
export const APIFY_WAIT_TIMEOUT = "wait-timeout";

/**
 * Client for lf_apify_runs bookkeeping. These functions also run from
 * session-less contexts (cron worker), so they never use the cookie-scoped
 * client: callers inject one, defaulting to the service-role client. Every
 * write carries or filters on `organization_id` explicitly.
 */
type RunsDb = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export class ApifyError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorType: string = "unknown",
    public readonly actionUrl?: string,
    public readonly actionLabel?: string
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

export function isApifyWaitTimeout(err: unknown): boolean {
  return err instanceof ApifyError && err.errorType === APIFY_WAIT_TIMEOUT;
}

export function parseApifyError(body: string, statusCode: number): ApifyError {
  try {
    const parsed = JSON.parse(body);
    const errorType: string = parsed?.error?.type || "";
    const errorMessage: string = parsed?.error?.message || "";

    if (
      errorType === "platform-feature-disabled" ||
      errorMessage.toLowerCase().includes("hard limit exceeded")
    ) {
      return new ApifyError(
        "Your Apify account has reached its monthly usage limit. Please upgrade your plan or wait for the next billing cycle.",
        statusCode,
        "usage-limit",
        "https://console.apify.com/billing",
        "Manage Apify billing"
      );
    }

    if (
      errorMessage.toLowerCase().includes("exceed the memory limit") ||
      errorMessage.toLowerCase().includes("memory limit")
    ) {
      return new ApifyError(
        "Apify account memory capacity is currently exhausted. Enrichment will retry after backoff.",
        statusCode,
        "memory-limit",
        "https://console.apify.com/billing/subscription",
        "Manage Apify memory capacity"
      );
    }

    if (statusCode === 401) {
      return new ApifyError(
        "Invalid Apify token. Check APIFY_API_TOKEN in your environment or the Lead Finder Settings page.",
        statusCode,
        "auth-invalid"
      );
    }

    if (statusCode === 403) {
      return new ApifyError(
        "Access denied. Please verify your Apify token is valid and your subscription covers this actor.",
        statusCode,
        "access-denied",
        "https://console.apify.com/billing",
        "Check Apify subscription"
      );
    }

    if (statusCode === 404) {
      return new ApifyError(
        "Actor not found. This actor ID may be incorrect or no longer available on Apify.",
        statusCode,
        "not-found"
      );
    }

    return new ApifyError(
      errorMessage || `Apify returned an unexpected error (${statusCode}).`,
      statusCode,
      "unknown"
    );
  } catch {
    if (statusCode === 401) {
      return new ApifyError(
        "Invalid Apify token. Check APIFY_API_TOKEN in your environment or the Lead Finder Settings page.",
        statusCode,
        "auth-invalid"
      );
    }
    if (statusCode === 403) {
      return new ApifyError(
        "Access denied. Your Apify subscription may not cover this actor or your usage limit has been reached.",
        statusCode,
        "access-denied",
        "https://console.apify.com/billing",
        "Check Apify subscription"
      );
    }
    if (statusCode === 404) {
      return new ApifyError(
        "Actor not found. This actor ID may be incorrect or no longer available on Apify.",
        statusCode,
        "not-found"
      );
    }
    return new ApifyError(
      `Apify returned an unexpected error (${statusCode}).`,
      statusCode,
      "unknown"
    );
  }
}

// ---------------------------------------------------------------------------
// Start an actor run (no waiting, no DB record)
// ---------------------------------------------------------------------------

/**
 * Start an Apify actor run and return the Apify run id without waiting for it
 * to finish. The caller supplies a token obtained via `authorizeActors`.
 */
export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<string> {
  // Actor IDs are of the form "owner/name"; Apify accepts "owner~name" in the URL.
  const encodedActorId = actorId.replace("/", "~");
  const res = await fetch(
    `${APIFY_BASE}/acts/${encodedActorId}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    throw parseApifyError(await res.text(), res.status);
  }

  const json = await res.json();
  const apifyRunId: unknown = json?.data?.id;
  if (typeof apifyRunId !== "string" || apifyRunId.length === 0) {
    throw new ApifyError("Apify did not return a run id.", res.status);
  }
  return apifyRunId;
}

// ---------------------------------------------------------------------------
// Run status (single check, no polling)
// ---------------------------------------------------------------------------

export type RunStatus = {
  status: "running" | "succeeded" | "failed";
  datasetId?: string;
  error?: string;
  costUsd?: number;
};

const FAILED_APIFY_STATUSES = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

/**
 * Map an Apify run object (`data` of GET /actor-runs/:id) to a RunStatus.
 * READY, RUNNING and the transitional TIMING-OUT / ABORTING map to running.
 */
export function mapApifyRunStatus(data: unknown): RunStatus {
  const run = (data ?? {}) as {
    status?: unknown;
    defaultDatasetId?: unknown;
    statusMessage?: unknown;
    usageTotalUsd?: unknown;
  };
  const apifyStatus = typeof run.status === "string" ? run.status : "";

  if (apifyStatus === "SUCCEEDED") {
    const result: RunStatus = { status: "succeeded" };
    if (typeof run.defaultDatasetId === "string") {
      result.datasetId = run.defaultDatasetId;
    }
    if (typeof run.usageTotalUsd === "number") {
      result.costUsd = run.usageTotalUsd;
    }
    return result;
  }

  if (FAILED_APIFY_STATUSES.has(apifyStatus)) {
    const message =
      typeof run.statusMessage === "string" && run.statusMessage
        ? run.statusMessage
        : `Actor run ${apifyStatus}`;
    return { status: "failed", error: message };
  }

  return { status: "running" };
}

/** Check an Apify run once and return its mapped status. */
export async function getRunStatus(
  runId: string,
  token: string
): Promise<RunStatus> {
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw parseApifyError(await res.text(), res.status);
  }

  const json = await res.json();
  return mapApifyRunStatus(json?.data);
}

// ---------------------------------------------------------------------------
// Start an actor run and record it in lf_apify_runs (used by runActorAndCollect)
// ---------------------------------------------------------------------------

export async function startRecordedActorRun(
  supabase: RunsDb,
  actorId: string,
  input: Record<string, unknown>,
  orgId: string,
  campaignId?: string
): Promise<{ runId: string; dbId: string }> {
  const cred = await authorizeActors(orgId, [actorId]);

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

  let apifyRunId: string;
  try {
    apifyRunId = await startActorRun(actorId, input, cred.token);
  } catch (err) {
    await supabase
      .from("lf_apify_runs")
      .update({ status: "failed" })
      .eq("id", dbRow.id)
      .eq("organization_id", orgId);
    throw err;
  }

  // Update DB with the actual run ID
  await supabase
    .from("lf_apify_runs")
    .update({ run_id: apifyRunId })
    .eq("id", dbRow.id)
    .eq("organization_id", orgId);

  return { runId: apifyRunId, dbId: dbRow.id };
}

// ---------------------------------------------------------------------------
// Poll until run finishes
// ---------------------------------------------------------------------------

export async function pollRunUntilDone(
  runId: string,
  orgId: string,
  dbId?: string,
  options?: { db?: RunsDb; maxWaitMs?: number }
): Promise<{
  status: "succeeded" | "failed";
  datasetId: string | null;
  costUsd: number | null;
}> {
  // No actor to authorize here; resolves the same tenant-first credential.
  const { token } = await authorizeActors(orgId, []);
  const supabase = options?.db ?? createAdminClient();
  const deadline =
    options?.maxWaitMs !== undefined ? Date.now() + options.maxWaitMs : null;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${token}` } }
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
          .eq("id", dbId)
          .eq("organization_id", orgId);
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
          .eq("id", dbId)
          .eq("organization_id", orgId);
      }

      throw new ApifyError(msg, undefined, apifyStatus);
    }

    // The caller's time budget cannot fit another poll: give up (retryable).
    if (deadline !== null && Date.now() + POLL_INTERVAL_MS > deadline) {
      if (dbId) {
        await supabase
          .from("lf_apify_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
          })
          .eq("id", dbId)
          .eq("organization_id", orgId);
      }
      throw new ApifyError(
        `Run ${runId} did not finish within ${options?.maxWaitMs} ms`,
        undefined,
        APIFY_WAIT_TIMEOUT
      );
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
  // No actor to authorize here; resolves the same tenant-first credential.
  const { token } = await authorizeActors(orgId, []);

  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?limit=${limit}&format=json`,
    { headers: { Authorization: `Bearer ${token}` } }
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

/**
 * `options.db` is the client for lf_apify_runs (default: service-role client;
 * rows always carry `organization_id`). `options.maxWaitMs` bounds the whole
 * call; when it runs out an ApifyError with errorType APIFY_WAIT_TIMEOUT is
 * thrown. Without it the 30-minute poll cap applies.
 */
export async function runActorAndCollect(
  actorId: string,
  input: Record<string, unknown>,
  orgId: string,
  campaignId?: string,
  itemLimit = 1000,
  options?: { db?: RunsDb; maxWaitMs?: number }
): Promise<{
  items: Record<string, unknown>[];
  runId: string;
  dbId: string;
  costUsd: number | null;
}> {
  const startedAt = Date.now();
  const supabase = options?.db ?? createAdminClient();
  const { runId, dbId } = await startRecordedActorRun(
    supabase,
    actorId,
    input,
    orgId,
    campaignId
  );

  const maxWaitMs =
    options?.maxWaitMs !== undefined
      ? Math.max(0, options.maxWaitMs - (Date.now() - startedAt))
      : undefined;
  const result = await pollRunUntilDone(runId, orgId, dbId, {
    db: supabase,
    maxWaitMs,
  });

  let items: Record<string, unknown>[] = [];
  if (result.datasetId) {
    items = await fetchDatasetItems(result.datasetId, orgId, itemLimit);

    // Update result count
    await supabase
      .from("lf_apify_runs")
      .update({ result_count: items.length })
      .eq("id", dbId)
      .eq("organization_id", orgId);
  }

  return {
    items,
    runId,
    dbId,
    costUsd: result.costUsd,
  };
}
