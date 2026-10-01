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

export async function listPendingApprovalsAction() {
  const { supabase, orgId } = await session();
  const { data, error } = await supabase
    .from("copilot_approvals")
    .select("id, approval_id, tool_name, diff, source, task_id, created_at")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(PENDING_LIMIT);
  if (error) throw new Error(`listPendingApprovals failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    approvalId: row.approval_id,
    toolName: row.tool_name,
    diff: row.diff as unknown as FieldDiff,
    source: row.source,
    taskId: row.task_id,
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
): Promise<{ status: "applied" | "denied" | "stale" | "failed" | "invalid"; result?: unknown }> {
  if (typeof rowId !== "string" || !UUID.test(rowId) || typeof approved !== "boolean") {
    return { status: "invalid" };
  }
  const { supabase, orgId, userId } = await session();
  const admin = createAdminClient();

  const { data: claimed, error } = await admin
    .from("copilot_approvals")
    .update({ status: approved ? "approved" : "denied", resolved_at: new Date().toISOString() })
    .eq("id", rowId)
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("source", "task")
    .is("conversation_id", null)
    .select("*");
  if (error) throw new Error(`resolveApproval claim failed: ${error.message}`);
  const row = claimed?.[0];
  if (!row) return { status: "invalid" };

  let outcome: { status: "applied" | "denied" | "stale" | "failed"; result?: unknown } = { status: "denied" };
  if (approved) {
    const env: CopilotToolEnv = {
      db: supabase,
      // isGuest only gates create_task, which task mode never proposes (see runApproved).
      ctx: { orgId, userId, isGuest: false, source: "chat", conversationId: null, taskId: row.task_id },
    };
    outcome = await runApproved(row, env);
    await markApprovalOutcome(admin, orgId, row.id, outcome.status as ApprovalOutcome, outcome.result);
  }

  await clearApprovalNotifications(orgId, userId);
  return outcome;
}

/** Runs a claimed row: staleness check against the live record, then the registry tool. */
async function runApproved(
  row: ApprovalRow,
  env: CopilotToolEnv,
): Promise<{ status: "applied" | "stale" | "failed"; result: unknown }> {
  // Only record writes a scheduled task can propose; anything else is a forged or stale row.
  const tool = listRegistryTools("task").find((t) => t.name === row.tool_name && t.kind === "write");
  if (!tool) return { status: "failed", result: { ok: false, error: `unknown_tool: ${row.tool_name}` } };
  const parsed = tool.inputSchema.safeParse(row.input);
  if (!parsed.success) return { status: "failed", result: { ok: false, error: "invalid_input" } };

  try {
    const diff = row.diff as unknown as FieldDiff;
    if (diff?.kind === "update") {
      const target = tool.toPatch?.(parsed.data);
      const live = target ? await fetchCurrentRecord(env, target) : null;
      if (isDiffStale(diff, live)) return { status: "stale", result: { ok: false, error: RECORD_CHANGED } };
    }
    const result = await executeRegistryTool(row.tool_name, row.input, env, { diff });
    if (result.ok) return { status: "applied", result };
    return { status: result.error === RECORD_CHANGED ? "stale" : "failed", result };
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
