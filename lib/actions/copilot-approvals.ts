"use server";

// Task approvals and undo for low-risk Copilot writes.
//
// Scheduled tasks never write records: they leave pending copilot_approvals rows (source
// 'task', no conversation). This file resolves those rows. Chat-sourced rows are resolved
// inside the chat turn (approval responses) and are rejected here as 'invalid'.
// copilot_approvals has no UPDATE policy, so the claim and the outcome go through the
// service-role client with explicit organization_id predicates; the approved write itself
// runs on the caller's RLS client.

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { markApprovalOutcome, type ApprovalOutcome, type ApprovalRow } from "@/lib/ai/approvals";
import { isDiffStale, type FieldDiff } from "@/lib/ai/tools/diff";
import { fetchCurrentRecord } from "@/lib/ai/tools/record-lookup";
import { executeRegistryTool, listRegistryTools, type CopilotToolEnv } from "@/lib/ai/tools/registry";
import { RECORD_CHANGED } from "@/lib/mcp/tools-write";
import { getOrgId } from "./helpers";
import { markNotificationRead } from "./notifications";
import { requireTwentyConnection } from "@/lib/twenty/connections";

const PENDING_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function session() {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, orgId, userId: user.id };
}

/** The caller's own pending rows (org AND user): only the owner can resolve them (044 RLS agrees). */
export async function listPendingApprovalsAction() {
  const { supabase, orgId, userId } = await session();
  const { data, error } = await supabase
    .from("copilot_approvals")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(PENDING_LIMIT);
  if (error) throw new Error(`listPendingApprovals failed: ${error.message}`);
  const visible = [];
  for (const row of data ?? []) {
    if (row.crm_source === "twenty") {
      try { await requireTwentyConnection({ db: createAdminClient(), orgId, userId, connectionId: row.connection_id ?? undefined }); } catch { continue; }
    }
    visible.push(row);
  }
  return visible.map((row) => ({
    id: row.id,
    approvalId: row.approval_id,
    toolName: row.tool_name,
    diff: row.diff as unknown as FieldDiff,
    source: row.source,
    taskId: row.task_id,
    workflowJobId: row.workflow_job_id ?? null,
    crmSource: row.crm_source ?? "pulse",
    createdAt: row.created_at,
  }));
}

/**
 * Approves or denies one task-sourced pending row. The claim is a single guarded UPDATE
 * (pending, source 'task', no conversation, owned by the caller), so a second resolve, a
 * chat-sourced row, another member's task row or a row of another org all come back
 * 'invalid' and are left untouched.
 */
export async function resolveApproval(
  rowId: string,
  approved: boolean,
): Promise<{ status: "applied" | "denied" | "stale" | "failed" | "invalid" | "partial" | "unknown_outcome"; result?: unknown }> {
  if (typeof rowId !== "string" || !UUID.test(rowId) || typeof approved !== "boolean") {
    return { status: "invalid" };
  }
  const { supabase, orgId, userId } = await session();
  const admin = createAdminClient();

  // Validate external access before changing approval state, including denials.
  const { data: candidate } = await admin.from("copilot_approvals").select("*").eq("id", rowId).eq("organization_id", orgId).eq("user_id", userId).eq("status", "pending").maybeSingle();
  if (!candidate || (candidate.source !== "task" && candidate.source !== "workflow") || candidate.conversation_id) return { status: "invalid" };
  if (candidate.source === "workflow") {
    if (candidate.crm_source !== "twenty" || !candidate.workflow_job_id || candidate.task_id) return { status: "invalid" };
    const { data: job, error: jobError } = await (admin as unknown as import("@supabase/supabase-js").SupabaseClient).from("twenty_jobs").select("id")
      .eq("id", candidate.workflow_job_id).eq("organization_id", orgId).eq("owner_id", userId).eq("connection_id", candidate.connection_id)
      .eq("connection_revision", candidate.connection_revision).eq("approval_id", candidate.id).eq("status", "awaiting_approval").maybeSingle();
    if (jobError || !job) return { status: "invalid" };
  }
  if (candidate.crm_source === "twenty") {
    try {
      const connection = await requireTwentyConnection({ db: admin, orgId, userId, connectionId: candidate.connection_id ?? undefined });
      if (connection.revision !== candidate.connection_revision) return { status: "invalid" };
    } catch { return { status: "invalid" }; }
  }

  const { data: claimed, error } = await admin
    .from("copilot_approvals")
    .update({ status: approved ? "approved" : "denied", resolved_at: new Date().toISOString() })
    .eq("id", rowId)
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("source", candidate.source)
    .is("conversation_id", null)
    .select("*");
  if (error) throw new Error(`resolveApproval claim failed: ${error.message}`);
  const row = claimed?.[0];
  if (!row) return { status: "invalid" };

  let outcome: { status: "applied" | "denied" | "stale" | "failed" | "partial" | "unknown_outcome"; result?: unknown } = { status: "denied" };
  if (approved) {
    const env: CopilotToolEnv = {
      db: supabase,
      // isGuest only gates create_task, which task mode never proposes (see runApproved).
      ctx: { orgId, userId, isGuest: false, source: row.crm_source === "twenty" ? row.source : "chat", conversationId: null, taskId: row.task_id, crmSource: row.crm_source ?? "pulse", connectionId: row.connection_id, connectionRevision: row.connection_revision ?? undefined, jobId: row.workflow_job_id },
    };
    outcome = await runApproved(row, env);
    await markApprovalOutcome(admin, orgId, row.id, outcome.status as ApprovalOutcome, outcome.result);
  }
  if (row.source === "workflow" && row.workflow_job_id) {
    const { resolveTwentyWorkflowApproval } = await import("@/lib/twenty/workflows/queue");
    await resolveTwentyWorkflowApproval(admin, { orgId, userId, jobId: row.workflow_job_id, approvalId: row.id, status: outcome.status, result: outcome.result });
  }

  await clearApprovalNotifications(orgId, userId);
  return outcome;
}

/** Runs a claimed row: staleness check against the live record, then the registry tool. */
async function runApproved(
  row: ApprovalRow,
  env: CopilotToolEnv,
): Promise<{ status: "applied" | "stale" | "failed" | "partial" | "unknown_outcome"; result: unknown }> {
  // Only record writes a scheduled task can propose; anything else is a forged or stale row.
  const tool = listRegistryTools(row.source === "workflow" ? "workflow" : "task", row.crm_source ?? "pulse").find((t) => t.name === row.tool_name && t.kind === "write");
  if (!tool) return { status: "failed", result: { ok: false, error: `unknown_tool: ${row.tool_name}` } };
  const parsed = tool.inputSchema.safeParse(row.input);
  if (!parsed.success) return { status: "failed", result: { ok: false, error: "invalid_input" } };

  try {
    const diff = row.diff as unknown as FieldDiff;
    if (!tool.executeApproved && diff?.kind === "update") {
      const target = tool.toPatch?.(parsed.data);
      const live = target ? await fetchCurrentRecord(env, target) : null;
      if (isDiffStale(diff, live)) return { status: "stale", result: { ok: false, error: RECORD_CHANGED } };
    }
    const result = await executeRegistryTool(row.tool_name, row.input, env, { diff });
    if (result.ok) return { status: "applied", result };
    return { status: result.outcome ?? (result.error === RECORD_CHANGED ? "stale" : "failed"), result };
  } catch (e) {
    // A claimed row must never stay 'approved' without an outcome.
    return { status: "failed", result: { ok: false, error: e instanceof Error ? e.message : "Unexpected error" } };
  }
}

/**
 * A task run leaves one approval_pending notification for its owner, with no link to the
 * individual rows. Once the caller has no pending task approvals left, mark theirs read.
 */
async function clearApprovalNotifications(orgId: string, userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("copilot_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .eq("source", "task")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return;
    const { count: workflowCount, error: workflowError } = await admin.from("copilot_approvals").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending").eq("source", "workflow").eq("user_id", userId);
    if (workflowError) throw new Error(workflowError.message);
    if ((workflowCount ?? 0) > 0) return;

    const supabase = await createClient();
    const { data, error: listError } = await supabase
      .from("notifications")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("kind", "approval_pending")
      .is("read_at", null);
    if (listError) throw new Error(listError.message);
    for (const n of data ?? []) await markNotificationRead(n.id);
  } catch (e) {
    // The approval outcome is already recorded; a stale badge must not turn it into an error.
    console.error("resolveApproval: clearing approval notifications failed", e);
  }
}

/** Reverts a low-risk Copilot write: artifacts are soft-deleted, memory is deactivated. */
export async function undoCopilotWrite(info: { tool: "save_artifact" | "save_memory"; id: string }): Promise<{ ok: boolean }> {
  const tool = info?.tool;
  const id = info?.id;
  if ((tool !== "save_artifact" && tool !== "save_memory") || typeof id !== "string" || !UUID.test(id)) {
    return { ok: false };
  }
  const { supabase, orgId } = await session();

  if (tool === "save_artifact") {
    const { data, error } = await supabase
      .from("copilot_artifacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select("id");
    return { ok: !error && (data?.length ?? 0) > 0 };
  }

  const { data, error } = await supabase
    .from("copilot_memory")
    .update({ is_active: false })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}
