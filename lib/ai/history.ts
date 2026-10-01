// Server-owned Copilot conversation history (migration 042).
//
// The model's history is what the server stored in copilot_messages, never
// what the client sends. Every function here takes the ADMIN (service-role)
// client: migration 044 removes member write access to copilot_messages, so
// the user's RLS client cannot write history. Because the admin client
// bypasses RLS, every query carries an explicit .eq("organization_id", orgId)
// and every write first checks that the conversation belongs to
// (orgId, userId).
//
// Upserts: copilot_messages_conv_msg_uq and copilot_conversations_page_uq are
// PARTIAL unique indexes. Postgres only infers a partial index for
// ON CONFLICT when the statement repeats its WHERE predicate, which
// PostgREST's on_conflict never does, so supabase-js .upsert() cannot target
// them. Writes here are update-then-insert instead, and an insert that loses
// a race (23505) falls back to the update / re-select.
//
// Turn lock: one turn per conversation at a time. Acquire sets
// turn_lock_until = app-now + 150 s (longer than the chat route's 120 s
// maxDuration) and a fresh turn_lock_token, only when the lock is free or
// expired. Release clears it only WHERE turn_lock_token = the caller's token,
// so a request whose lock expired can never clear a newer holder's lock.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isToolUIPart, type UIMessage } from "ai";
import type { Database, Json } from "@/types/database";
import type { ApprovalResponse } from "@/lib/ai/approvals";

type AdminClient = SupabaseClient<Database>;
type MessageRole = "user" | "assistant";

export const TURN_LOCK_TTL_SECONDS = 150;

const UNIQUE_VIOLATION = "23505";

function fail(op: string, error: { message: string }): never {
  throw new Error(`copilot history ${op} failed: ${error.message}`);
}

const isUniqueViolation = (error: { code?: string } | null) => error?.code === UNIQUE_VIOLATION;

// ─── Conversations ──────────────────────────────────────────────────────────

/**
 * Returns the caller's conversation. A supplied id must belong to the org AND
 * the user, otherwise not_found. Without an id, a pageKey resolves to the one
 * conversation per (org, user, page); with neither, a new one is created.
 */
export async function getOrCreateConversation(
  db: AdminClient,
  args: { orgId: string; userId: string; conversationId?: string | null; pageKey?: string | null; title?: string },
): Promise<{ id: string } | { error: "not_found" }> {
  if (args.conversationId) {
    const { data, error } = await db
      .from("copilot_conversations")
      .select("id")
      .eq("id", args.conversationId)
      .eq("organization_id", args.orgId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error) fail("conversation lookup", error);
    return data ? { id: data.id } : { error: "not_found" };
  }

  const pageKey = args.pageKey ?? null;
  if (pageKey) {
    const existing = await findPageConversation(db, args.orgId, args.userId, pageKey);
    if (existing) return existing;
  }

  const { data, error } = await db
    .from("copilot_conversations")
    .insert({
      organization_id: args.orgId,
      user_id: args.userId,
      page_key: pageKey,
      ...(args.title ? { title: args.title } : {}),
    })
    .select("id")
    .single();
  if (!error) return { id: data.id };

  // Another request created this page's conversation between our select and insert.
  if (pageKey && isUniqueViolation(error)) {
    const winner = await findPageConversation(db, args.orgId, args.userId, pageKey);
    if (winner) return winner;
  }
  fail("conversation insert", error);
}

async function findPageConversation(
  db: AdminClient,
  orgId: string,
  userId: string,
  pageKey: string,
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from("copilot_conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("page_key", pageKey)
    .maybeSingle();
  if (error) fail("page conversation lookup", error);
  return data ? { id: data.id } : null;
}

async function assertOwnConversation(db: AdminClient, conversationId: string, orgId: string, userId: string) {
  const { data, error } = await db
    .from("copilot_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("conversation ownership check", error);
  if (!data) throw new Error("copilot history: conversation not found for this user");
}

// ─── Messages ───────────────────────────────────────────────────────────────

const textOf = (message: UIMessage) =>
  message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

/**
 * The conversation's history as UIMessages, ordered by seq then created_at.
 * Legacy rows (written before 042) have no parts and no seq: they sort first
 * and become a single text part with the row id as message id.
 */
export async function loadUiMessages(db: AdminClient, conversationId: string, orgId: string): Promise<UIMessage[]> {
  const { data, error } = await db
    .from("copilot_messages")
    .select("id, message_id, role, content, parts")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId)
    .order("seq", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) fail("load messages", error);

  return (data ?? []).map((row) => ({
    id: row.message_id ?? row.id,
    role: row.role,
    parts: Array.isArray(row.parts)
      ? (row.parts as unknown as UIMessage["parts"])
      : [{ type: "text" as const, text: row.content }],
  }));
}

type ExistingRow = { id: string; message_id: string | null; seq: number | null; parts: Json | null };

/** Existing rows keyed by message id; a legacy row (no message_id) is keyed by its row id. */
async function existingRows(db: AdminClient, conversationId: string, orgId: string) {
  const { data, error } = await db
    .from("copilot_messages")
    .select("id, message_id, seq, parts")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId);
  if (error) fail("load existing messages", error);
  const byKey = new Map<string, ExistingRow>();
  for (const row of data ?? []) byKey.set(row.message_id ?? row.id, row);
  return byKey;
}

async function updateRow(
  db: AdminClient,
  where: { orgId: string; conversationId: string; column: "id" | "message_id"; value: string },
  values: { parts: Json; content: string; seq: number; message_id: string },
): Promise<boolean> {
  const { data, error } = await db
    .from("copilot_messages")
    .update(values)
    .eq("organization_id", where.orgId)
    .eq("conversation_id", where.conversationId)
    .eq(where.column, where.value)
    .select("id");
  if (error) fail("update message", error);
  return (data?.length ?? 0) > 0;
}

/** Writes one message: updates its row if it has one, inserts otherwise. Never deletes. */
async function writeMessage(
  db: AdminClient,
  args: { conversationId: string; orgId: string; message: UIMessage; seq: number; existing: ExistingRow | undefined },
): Promise<void> {
  const { conversationId, orgId, message, seq, existing } = args;
  const values = {
    parts: message.parts as unknown as Json,
    content: textOf(message),
    seq,
    message_id: message.id,
  };
  const scope = { orgId, conversationId };

  if (existing) {
    const unchanged = existing.message_id === message.id && existing.seq === seq &&
      JSON.stringify(existing.parts) === JSON.stringify(values.parts);
    if (unchanged) return;
    await updateRow(db, { ...scope, column: "id", value: existing.id }, values);
    return;
  }

  const { error } = await db.from("copilot_messages").insert({
    conversation_id: conversationId,
    organization_id: orgId,
    role: message.role as MessageRole,
    ...values,
  });
  if (!error) return;
  // A concurrent write inserted this message id first: update that row instead.
  if (isUniqueViolation(error) && (await updateRow(db, { ...scope, column: "message_id", value: message.id }, values))) {
    return;
  }
  fail("insert message", error);
}

const isStorableRole = (role: UIMessage["role"]): role is MessageRole => role === "user" || role === "assistant";

/** Stores the new user message before the model runs, so a failed turn still keeps it. */
export async function persistUserMessage(
  db: AdminClient,
  args: { conversationId: string; orgId: string; userId: string; message: UIMessage; seq: number },
): Promise<void> {
  if (args.message.role !== "user") throw new Error("copilot history: persistUserMessage needs a user message");
  await assertOwnConversation(db, args.conversationId, args.orgId, args.userId);
  const existing = (await existingRows(db, args.conversationId, args.orgId)).get(args.message.id);
  await writeMessage(db, { ...args, existing });
}

/**
 * Upserts every message on (conversation_id, message_id): parts, the joined
 * text as content, and seq = its index. Unchanged rows are skipped; rows are
 * never deleted. System messages are not stored.
 */
export async function persistUiMessages(
  db: AdminClient,
  args: { conversationId: string; orgId: string; userId: string; messages: UIMessage[] },
): Promise<void> {
  await assertOwnConversation(db, args.conversationId, args.orgId, args.userId);
  const existing = await existingRows(db, args.conversationId, args.orgId);
  for (const [seq, message] of args.messages.entries()) {
    if (!isStorableRole(message.role)) continue;
    await writeMessage(db, {
      conversationId: args.conversationId,
      orgId: args.orgId,
      message,
      seq,
      existing: existing.get(message.id),
    });
  }
}

// ─── Approvals ──────────────────────────────────────────────────────────────

/**
 * Applies the user's approval responses to the stored history. Pure. Only the
 * LAST assistant message is searched: each response whose approvalId matches
 * a tool part in state approval-requested moves that part to
 * approval-responded (what useChat's addToolApprovalResponse does client-side;
 * convertToModelMessages turns it into a tool-approval-response). Responses
 * that match nothing are returned in `unmatched`.
 */
export function applyApprovalResponses(
  messages: UIMessage[],
  responses: ApprovalResponse[],
): { messages: UIMessage[]; unmatched: string[] } {
  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant");
  if (lastAssistant === -1) return { messages, unmatched: responses.map((r) => r.approvalId) };

  let parts = messages[lastAssistant].parts;
  const unmatched: string[] = [];
  for (const response of responses) {
    const index = parts.findIndex(
      (p) => isToolUIPart(p) && p.state === "approval-requested" && p.approval.id === response.approvalId,
    );
    if (index === -1) {
      unmatched.push(response.approvalId);
      continue;
    }
    const part = parts[index] as Extract<UIMessage["parts"][number], { state: "approval-requested" }>;
    const responded = {
      ...part,
      state: "approval-responded" as const,
      approval: { ...part.approval, approved: response.approved, reason: response.reason },
    } as unknown as UIMessage["parts"][number];
    parts = parts.map((p, i) => (i === index ? responded : p));
  }

  if (parts === messages[lastAssistant].parts) return { messages, unmatched };
  const updated = { ...messages[lastAssistant], parts };
  return { messages: messages.map((m, i) => (i === lastAssistant ? updated : m)), unmatched };
}

// ─── Turn lock ──────────────────────────────────────────────────────────────

/**
 * Takes the conversation's turn lock if it is free or expired. Returns the
 * lock token (needed to release it), or null when another turn holds it.
 */
export async function acquireTurnLock(
  db: AdminClient,
  args: { conversationId: string; orgId: string; ttlSeconds?: number },
): Promise<string | null> {
  const now = Date.now();
  const token = crypto.randomUUID();
  const nowIso = new Date(now).toISOString();
  const { data, error } = await db
    .from("copilot_conversations")
    .update({
      turn_lock_until: new Date(now + (args.ttlSeconds ?? TURN_LOCK_TTL_SECONDS) * 1000).toISOString(),
      turn_lock_token: token,
    })
    .eq("id", args.conversationId)
    .eq("organization_id", args.orgId)
    .or(`turn_lock_until.is.null,turn_lock_until.lt."${nowIso}"`)
    .select("id");
  if (error) fail("acquire turn lock", error);
  return (data?.length ?? 0) > 0 ? token : null;
}

/** Releases the lock only if this caller still holds it (its token matches). */
export async function releaseTurnLock(
  db: AdminClient,
  args: { conversationId: string; orgId: string; token: string },
): Promise<void> {
  const { error } = await db
    .from("copilot_conversations")
    .update({ turn_lock_until: null, turn_lock_token: null })
    .eq("id", args.conversationId)
    .eq("organization_id", args.orgId)
    .eq("turn_lock_token", args.token);
  if (error) fail("release turn lock", error);
}
