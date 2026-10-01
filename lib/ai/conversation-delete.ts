// Deletes a member's own Copilot conversations (deleteConversation, clearChatHistory).
//
// Takes the ADMIN (service-role) client: copilot_approvals has no UPDATE policy (042), so
// detaching the approvals to keep needs the service role. Because that client bypasses
// RLS, every query carries explicit organization_id AND user_id predicates.
//
// Messages, and pending / denied / expired chat approvals, cascade with the conversation.
// Approvals the user granted (approved, applied, failed, stale) and task-sourced approvals
// are detached first so they survive. Artifacts lose the link (ON DELETE SET NULL).
// Refuses while any targeted conversation holds an unexpired turn lock.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;
type ApprovalUpdate = Database["public"]["Tables"]["copilot_approvals"]["Update"];

/** Statuses of approvals the user granted: kept (detached) when their conversation is deleted. */
const KEPT_APPROVAL_STATUSES = ["approved", "applied", "failed", "stale"];

function fail(op: string, error: { message: string }): never {
  throw new Error(`copilot conversation delete: ${op} failed: ${error.message}`);
}

/**
 * Deletes the caller's conversations in the org: all of them, or only `ids` when given.
 * Returns how many were deleted, or turn_in_progress (nothing deleted) while one is mid-turn.
 */
export async function deleteOwnConversations(
  admin: AdminClient,
  args: { orgId: string; userId: string; ids?: string[] },
): Promise<{ deleted: number } | { error: "turn_in_progress" }> {
  let list = admin
    .from("copilot_conversations")
    .select("id, turn_lock_until")
    .eq("organization_id", args.orgId)
    .eq("user_id", args.userId);
  if (args.ids) list = list.in("id", args.ids);
  const { data: conversations, error: listError } = await list;
  if (listError) fail("listing conversations", listError);
  if (!conversations?.length) return { deleted: 0 };

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  if (conversations.some((c) => c.turn_lock_until && Date.parse(c.turn_lock_until) > now)) {
    return { error: "turn_in_progress" };
  }
  const ids = conversations.map((c) => c.id);

  // copilot_approvals.conversation_id cascades on delete: detach the rows to keep first.
  // The generated Update type (types/database.ts) omits conversation_id on purpose for the
  // approval lifecycle; detaching before a delete is the one writer of that column.
  const detach = { conversation_id: null } as unknown as ApprovalUpdate;
  const { error: detachError } = await admin
    .from("copilot_approvals")
    .update(detach)
    .eq("organization_id", args.orgId)
    .in("conversation_id", ids)
    .or(`source.eq.task,status.in.(${KEPT_APPROVAL_STATUSES.join(",")})`);
  if (detachError) fail("keeping approvals", detachError);

  // A conversation that took a turn lock since the check above is left alone.
  const { data: deleted, error: deleteError } = await admin
    .from("copilot_conversations")
    .delete()
    .eq("organization_id", args.orgId)
    .eq("user_id", args.userId)
    .in("id", ids)
    .or(`turn_lock_until.is.null,turn_lock_until.lt."${nowIso}"`)
    .select("id");
  if (deleteError) fail("deleting conversations", deleteError);
  return { deleted: deleted?.length ?? 0 };
}
