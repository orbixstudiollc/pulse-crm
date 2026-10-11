import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTwentyConnection } from "@/lib/twenty/connections";
import { getTwentyClient } from "@/lib/twenty/client";
import { mailboxIsReady, recordVersion, type TwentyWorkflow } from "./types";

/** One page per lease bounds requests and persists progress only after all jobs are durable. */
export async function pollTwentyWorkflow(db: SupabaseClient, workflow: TwentyWorkflow): Promise<number> {
  const connection = await requireTwentyConnection({ db, orgId: workflow.organization_id, userId: workflow.owner_id, connectionId: workflow.connection_id });
  if (connection.revision !== workflow.connection_revision) throw new Error("connection_changed");
  const checkpoint = { ...workflow.checkpoint };
  const now = new Date().toISOString();
  let enqueued = 0;
  // Person workflows start from activation time, without walking or scheduling old leads.
  if (!checkpoint.initialized && workflow.kind !== "mailbox_ready") {
    checkpoint.initialized = true;
    checkpoint.updatedAfter = now;
  } else {
    const baseline = !checkpoint.initialized;
    if (baseline) checkpoint.baselineStartedAt ??= now;
    const client = getTwentyClient(connection);
    const page = await client.list(workflow.kind === "mailbox_ready" ? "mailbox" : "person", {
      limit: 50, after: checkpoint.after ?? undefined,
      ...(baseline ? {} : { updatedAfter: checkpoint.updatedAfter }),
    });
    for (const record of page.records) {
      const version = recordVersion(record);
      const recordId = String(record.id);
      checkpoint.highWater = !checkpoint.highWater || version > checkpoint.highWater ? version : checkpoint.highWater;
      const { data: observed, error: observeError } = await db.rpc("twenty_observe_record", {
        p_org: workflow.organization_id, p_workflow: workflow.id, p_token: workflow.lease_token,
        p_record: recordId, p_version: version, p_baseline: baseline,
        p_ready: workflow.kind === "mailbox_ready" ? mailboxIsReady(record) : null,
      });
      if (observeError) throw new Error("record_observation_failed");
      if (observed === true) enqueued++;
    }
    checkpoint.after = page.hasNextPage ? page.endCursor : null;
    if (page.hasNextPage && !page.endCursor) throw new Error("invalid_pagination");
    if (!page.hasNextPage) {
      // Inclusive watermark handles equal timestamps; record/version dedupe absorbs repeats.
      checkpoint.updatedAfter = baseline ? checkpoint.baselineStartedAt : checkpoint.highWater ?? checkpoint.updatedAfter;
      checkpoint.initialized = true;
      delete checkpoint.baselineStartedAt;
      delete checkpoint.highWater;
    }
  }
  const { data, error } = await db.from("twenty_workflows").update({ checkpoint, lease_token: null, lease_until: null, last_error: null, updated_at: now })
    .eq("organization_id", workflow.organization_id).eq("id", workflow.id).eq("lease_token", workflow.lease_token)
    .gt("lease_until", new Date().toISOString()).select("id");
  if (error || data?.length !== 1) throw new Error("poll_lease_lost");
  return enqueued;
}

export async function runTwentyPolling(db: SupabaseClient): Promise<{ workflows: number; enqueued: number; failed: number }> {
  const { data, error } = await db.rpc("claim_twenty_workflows", { p_limit: 10 });
  if (error) throw new Error("Workflow leases could not be acquired");
  const result = { workflows: 0, enqueued: 0, failed: 0 };
  const deadline = Date.now() + 45_000;
  for (const workflow of (data ?? []) as TwentyWorkflow[]) {
    if (Date.now() >= deadline) break;
    result.workflows++;
    try { result.enqueued += await pollTwentyWorkflow(db, workflow); }
    catch {
      result.failed++;
      const { error: persistError } = await db.from("twenty_workflows").update({ last_error: "Polling failed; check connection permissions and owner access", lease_token: null, lease_until: null, updated_at: new Date().toISOString() })
        .eq("organization_id", workflow.organization_id).eq("id", workflow.id).eq("lease_token", workflow.lease_token).gt("lease_until", new Date().toISOString());
      if (persistError) throw new Error("Polling failure could not be persisted");
    }
  }
  return result;
}
