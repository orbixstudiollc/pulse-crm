import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldDiff } from "@/lib/ai/tools/diff";
import { retryDelay, type TwentyJob, type JobStatus } from "./types";

export async function auditTwentyJob(db: SupabaseClient, job: TwentyJob, event: string, details: Record<string, unknown> = {}) {
  const { error } = await db.from("twenty_workflow_runs").insert({ organization_id: job.organization_id, workflow_id: job.workflow_id, job_id: job.id, event, details });
  if (error) throw new Error("Twenty audit could not be persisted");
}

/** Every completion carries the lease token. An expired worker cannot replace newer work. */
export async function finishTwentyJob(db: SupabaseClient, job: TwentyJob, status: JobStatus, result?: unknown) {
  const { data, error } = await db.from("twenty_jobs").update({ status, result: result ?? null, lease_token: null, lease_until: null, updated_at: new Date().toISOString() })
    .eq("organization_id", job.organization_id).eq("id", job.id).eq("status", "running").eq("lease_token", job.lease_token)
    .gt("lease_until", new Date().toISOString()).select("id");
  if (error) throw new Error("Twenty job outcome could not be persisted");
  if (data?.length !== 1) throw new Error("job_lease_lost");
  await auditTwentyJob(db, job, status);
}

export async function retryTwentyJob(db: SupabaseClient, job: TwentyJob, reason: string) {
  const final = job.attempts >= 5;
  const { data, error } = await db.from("twenty_jobs").update({
    status: final ? "failed" : "queued", result: { error: reason }, lease_token: null, lease_until: null,
    next_attempt_at: new Date(Date.now() + retryDelay(job.attempts)).toISOString(), updated_at: new Date().toISOString(),
  }).eq("organization_id", job.organization_id).eq("id", job.id).eq("status", "running").eq("lease_token", job.lease_token)
    .gt("lease_until", new Date().toISOString()).select("id");
  if (error) throw new Error("Twenty retry could not be persisted");
  if (data?.length !== 1) throw new Error("job_lease_lost");
  await auditTwentyJob(db, job, final ? "failed" : "retry_scheduled", { reason, attempt: job.attempts });
}

/** Proposals and queue transitions are committed together, guarded by the current lease. */
export async function stageTwentyJobApproval(db: SupabaseClient, job: TwentyJob, toolName: string, input: Record<string, unknown>, diff: FieldDiff): Promise<string> {
  const { data, error } = await db.rpc("twenty_stage_job_approval", { p_org: job.organization_id, p_job: job.id, p_token: job.lease_token, p_tool: toolName, p_input: input, p_diff: diff });
  if (error || typeof data !== "string") throw new Error("Twenty approval could not be staged");
  return data;
}

/** Called only after the approval resolver has persisted its terminal outcome. */
export async function resolveTwentyWorkflowApproval(db: SupabaseClient, args: {
  orgId: string; userId: string; jobId: string; approvalId: string;
  status: "applied" | "denied" | "stale" | "failed" | "unknown_outcome" | "partial"; result?: unknown;
}) {
  const { data: approval, error: approvalError } = await db.from("copilot_approvals").select("status,workflow_job_id")
    .eq("organization_id", args.orgId).eq("user_id", args.userId).eq("id", args.approvalId)
    .eq("source", "workflow").maybeSingle();
  if (approvalError || approval?.status !== args.status || approval.workflow_job_id !== args.jobId) throw new Error("Invalid workflow approval outcome");
  const { data, error } = await db.from("twenty_jobs").update({ status: args.status, result: args.result ?? null, updated_at: new Date().toISOString() })
    .eq("organization_id", args.orgId).eq("owner_id", args.userId).eq("id", args.jobId).eq("approval_id", args.approvalId)
    .eq("status", "awaiting_approval").select("*");
  if (error) throw new Error("Twenty workflow outcome could not be persisted");
  if (data?.[0]) await auditTwentyJob(db, data[0] as TwentyJob, `approval_${args.status}`);
}
