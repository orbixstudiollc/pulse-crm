// Approval store for AI write tools. Server-only: copilot_approvals has no
// INSERT/UPDATE/DELETE policy (migration 042), so every write goes through the
// service-role client passed in here. Because that client bypasses RLS, every
// query on a tenant's rows carries an explicit .eq("organization_id", orgId).
// The one exception is expireApprovals, the cross-org sweep run by the cron.
//
// Lifecycle: pending -> approved | denied (claimApproval, atomic)
//            approved -> applied | failed | stale (markApprovalOutcome)
//            pending -> expired (expireApprovals)
// A failed or stale row never goes back to pending; a retry is a new proposal.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { Database, Json } from "@/types/database";
import type { FieldDiff } from "@/lib/ai/tools/diff";

type AdminClient = SupabaseClient<Database>;
export type ApprovalRow = Database["public"]["Tables"]["copilot_approvals"]["Row"];
export type ApprovalSource = "chat" | "task";
export type ApprovalOutcome = "applied" | "failed" | "stale";

export type ApprovalResponse = { approvalId: string; approved: boolean; reason?: string };

export type ClaimResult =
  | { status: "claimed"; row: ApprovalRow }
  | { status: "not_pending" }
  | { status: "not_found" };

const TABLE = "copilot_approvals";
const HOUR_MS = 60 * 60 * 1000;

function fail(op: string, error: { message: string }): never {
  throw new Error(`copilot_approvals ${op} failed: ${error.message}`);
}

/**
 * Records a proposed write as a pending row. Idempotent per
 * (organization_id, tool_call_id): a repeat returns the existing row's id.
 */
export async function recordPendingApproval(
  admin: AdminClient,
  args: {
    orgId: string;
    userId: string | null;
    conversationId: string | null;
    taskId: string | null;
    source: ApprovalSource;
    toolCallId: string;
    toolName: string;
    input: unknown;
    diff: FieldDiff;
  },
): Promise<{ id: string }> {
  // INSERT ... ON CONFLICT (organization_id, tool_call_id) DO NOTHING RETURNING id.
  // An insert has no filter to scope; the org is the row's own organization_id.
  const { data: inserted, error: insertError } = await admin
    .from(TABLE)
    .upsert(
      {
        organization_id: args.orgId,
        user_id: args.userId,
        conversation_id: args.conversationId,
        task_id: args.taskId,
        source: args.source,
        tool_call_id: args.toolCallId,
        tool_name: args.toolName,
        input: (args.input ?? null) as Json,
        diff: args.diff as unknown as Json,
      },
      { onConflict: "organization_id,tool_call_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (insertError) fail("insert", insertError);
  if (inserted) return { id: inserted.id };

  const { data: existing, error: selectError } = await admin
    .from(TABLE)
    .select("id")
    .eq("organization_id", args.orgId)
    .eq("tool_call_id", args.toolCallId)
    .single();
  if (selectError) fail("select existing", selectError);
  return { id: existing.id };
}

/** Stores the AI SDK approval ids on pending rows. Never overwrites an existing approval_id. */
export async function attachApprovalIds(
  admin: AdminClient,
  args: { orgId: string; conversationId: string; pairs: Array<{ toolCallId: string; approvalId: string }> },
): Promise<void> {
  for (const pair of args.pairs) {
    const { error } = await admin
      .from(TABLE)
      .update({ approval_id: pair.approvalId })
      .eq("organization_id", args.orgId)
      .eq("conversation_id", args.conversationId)
      .eq("tool_call_id", pair.toolCallId)
      .is("approval_id", null);
    if (error) fail("attach approval id", error);
  }
}

/**
 * Atomically moves a pending row to approved/denied. Only one caller can win:
 * the UPDATE matches status = 'pending'. conversationId must match exactly
 * (NULL matches NULL), so an id from another conversation reads as not_found.
 */
export async function claimApproval(
  admin: AdminClient,
  args: { orgId: string; conversationId: string | null; approvalId: string; approved: boolean },
): Promise<ClaimResult> {
  let claim = admin
    .from(TABLE)
    .update({ status: args.approved ? "approved" : "denied", resolved_at: new Date().toISOString() })
    .eq("organization_id", args.orgId)
    .eq("approval_id", args.approvalId)
    .eq("status", "pending");
  claim = args.conversationId === null
    ? claim.is("conversation_id", null)
    : claim.eq("conversation_id", args.conversationId);
  const { data: claimed, error: claimError } = await claim.select("*");
  if (claimError) fail("claim", claimError);
  if (claimed && claimed.length > 0) return { status: "claimed", row: claimed[0] };

  let lookup = admin
    .from(TABLE)
    .select("id")
    .eq("organization_id", args.orgId)
    .eq("approval_id", args.approvalId);
  lookup = args.conversationId === null
    ? lookup.is("conversation_id", null)
    : lookup.eq("conversation_id", args.conversationId);
  const { data: found, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) fail("claim lookup", lookupError);
  return found ? { status: "not_pending" } : { status: "not_found" };
}

/** Records what happened after a claimed approval ran. Never returns a row to pending. */
export async function markApprovalOutcome(
  admin: AdminClient,
  orgId: string,
  id: string,
  outcome: ApprovalOutcome,
  result?: unknown,
): Promise<void> {
  const { error } = await admin
    .from(TABLE)
    .update({ status: outcome, result: (result ?? null) as Json })
    .eq("organization_id", orgId)
    .eq("id", id);
  if (error) fail("mark outcome", error);
}

/** Pending approvals for one org, newest first. */
export async function listPendingApprovals(
  admin: AdminClient,
  orgId: string,
  opts?: { source?: ApprovalSource },
): Promise<ApprovalRow[]> {
  let query = admin
    .from(TABLE)
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "pending");
  if (opts?.source) query = query.eq("source", opts.source);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) fail("list pending", error);
  return data ?? [];
}

/** Cron sweep across all orgs: pending rows older than the cutoff become expired. Returns the count. */
export async function expireApprovals(admin: AdminClient, olderThanHours = 72): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * HOUR_MS).toISOString();
  const { data, error } = await admin
    .from(TABLE)
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) fail("expire", error);
  return data?.length ?? 0;
}

/** Tool parts of a message that are waiting for the user's approval. Pure. */
export function extractApprovalRequests(
  message: UIMessage,
): Array<{ toolCallId: string; approvalId: string; toolName: string }> {
  const requests: Array<{ toolCallId: string; approvalId: string; toolName: string }> = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "approval-requested") continue;
    requests.push({ toolCallId: part.toolCallId, approvalId: part.approval.id, toolName: getToolName(part) });
  }
  return requests;
}
