import { after } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  getToolName,
  isToolUIPart,
  simulateStreamingMiddleware,
  stepCountIs,
  streamText,
  wrapLanguageModel,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { assembleContext, loadMemoryBlock } from "@/lib/ai/context";
import { createAIMessagesClient, logTokenUsage, tokenLimitReason } from "@/lib/ai/client";
import { getModelId } from "@/lib/ai/models";
import { customModelSettingsFor, resolveAIProvider } from "@/lib/ai/provider-resolver";
import { sharedTurnBudget } from "@/lib/ai/shared-budget";
import { SharedBudgetError } from "@/lib/ai/shared-budget-core";
import { describeProviderError } from "@/lib/ai/chat-error";
import { aiSdkBaseUrl, createCustomFetch, customModelFor } from "@/lib/ai/custom-provider";
import { checkRateLimit, acquireRateLimit } from "@/lib/ai/rate-limiter";
import { chatRequestSchema, type ChatRequest } from "@/lib/ai/chat-request";
import {
  acquireTurnLock,
  applyApprovalResponses,
  getOrCreateConversation,
  loadUiMessages,
  persistUiMessages,
  persistUserMessage,
  releaseTurnLock,
} from "@/lib/ai/history";
import {
  attachApprovalIds,
  claimApproval,
  extractApprovalRequests,
  markApprovalOutcome,
  recordPendingApproval,
  type ApprovalOutcome,
  type ApprovalResponse,
  type ApprovalRow,
} from "@/lib/ai/approvals";
import { buildCopilotToolSet, type CopilotToolEnv } from "@/lib/ai/tools/registry";
import { sanitizeAlwaysAllow } from "@/lib/ai/tools/policy";
import type { FieldDiff } from "@/lib/ai/tools/diff";
import { RECORD_CHANGED } from "@/lib/mcp/tools-write";
import type { Json } from "@/types/database";

// 120 s, not 60: a turn may run CHAT_MAX_STEPS (8) tool steps plus the live-record
// lookups behind each proposed write's diff, which exceeds 60 s. A function killed by
// the platform before onFinish would leak the shared-budget reservation and orphan
// approval cards (pending rows with no approval_id, history never persisted, turn lock
// held until its TTL). So an internal AbortController ends the turn at
// TURN_DEADLINE_MS (100 s): onAbort/onFinish, persistence and the lock release then
// always run inside the 120 s budget.
export const maxDuration = 120;

/** Tool-use steps per chat turn (stopWhen). */
const CHAT_MAX_STEPS = 8;
/** Output cap per step on the owner's shared (env) key. */
const SHARED_CHAT_MAX_OUTPUT_TOKENS = 4096;
/** The turn is aborted here, well under maxDuration, so its cleanup always runs. */
const TURN_DEADLINE_MS = 100_000;
/** Most stored UI messages the model sees per turn (the full history stays stored). */
const MAX_MODEL_MESSAGES = 40;
/** Hard cap on the workspace-memory block in the system prompt. */
const MEMORY_CAP_TOKENS = 1500;

/** Providers reached through the Anthropic protocol support tool calling. */
const TOOL_PROVIDERS = new Set(["anthropic", "openrouter", "custom"]);

const NO_TOOLS_NOTICE =
  "This AI provider can't use CRM tools, so Copilot answers from the page context only and can't look up or change records. Use Anthropic, OpenRouter or a custom Anthropic-compatible provider in Settings → AI Assistant for full Copilot.";
const PROVIDER_FAILED = "The AI provider request failed. Please try again.";

type AdminClient = ReturnType<typeof createAdminClient>;
type ClaimedApproval = { row: ApprovalRow; response: ApprovalResponse };
type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

function chatErrorText(error: unknown): string {
  // The shared-key reservation was refused: show the reason.
  if (error instanceof SharedBudgetError) return error.message;
  console.error("AI Chat stream error:", describeProviderError(error));
  return PROVIDER_FAILED;
}

/**
 * Claims each approval atomically (a repeated or unknown id is invalid, never re-run). Each
 * claim is pushed to `claimed` as it happens, so a failure part-way still knows what it claimed.
 */
async function claimApprovals(
  admin: AdminClient,
  args: { orgId: string; conversationId: string; approvals: ChatRequest["approvals"] },
  claimed: ClaimedApproval[],
): Promise<{ invalid: string[] }> {
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const approval of args.approvals) {
    if (seen.has(approval.approvalId)) {
      invalid.push(approval.approvalId);
      continue;
    }
    seen.add(approval.approvalId);
    const result = await claimApproval(admin, {
      orgId: args.orgId,
      conversationId: args.conversationId,
      approvalId: approval.approvalId,
      approved: approval.approved,
    });
    if (result.status === "claimed") claimed.push({ row: result.row, response: approval });
    else invalid.push(approval.approvalId);
  }
  return { invalid };
}

/** The approval outcome a write tool's result stands for. */
function resultOutcome(output: unknown): ApprovalOutcome {
  const o = output as { ok?: unknown; error?: unknown } | null;
  if (o && typeof o === "object" && o.ok === false) return o.error === RECORD_CHANGED ? "stale" : "failed";
  return "applied";
}

/** What a claimed, approved write's tool part says happened. */
function approvalOutcome(part: ToolPart | undefined): { outcome: ApprovalOutcome; result: unknown } {
  if (part?.state === "output-available") return { outcome: resultOutcome(part.output), result: part.output ?? null };
  if (part?.state === "output-error") return { outcome: "failed", result: { error: part.errorText } };
  return { outcome: "failed", result: { error: "not_executed" } };
}

/** JSON with sorted keys (jsonb does not keep key order), for comparing stored tool inputs. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * ai 6 executes every approved, output-less tool part of the last assistant message. Only
 * approvals claimed by this request may run, and only as the exact call their row records:
 * a part stays open when its approval id was claimed AND its toolCallId and tool name are the
 * row's AND its response matches the row's status (one part per row). Every other
 * approval-responded part (a card approved in an earlier request that failed, one planted in
 * the stored history, or a claimed approval id moved onto another toolCallId) is closed:
 * approved ones become output-error 'not_executed', denied ones output-denied. A bound,
 * approved part whose stored input differs from its row's becomes output-error
 * 'input_mismatch' (finishTurn then marks the row failed). Pure.
 */
function closeUnclaimedApprovals(messages: UIMessage[], claimed: Map<string, ApprovalRow>): UIMessage[] {
  const kept = new Set<string>();
  return messages.map((message) => {
    let changed = false;
    const parts = message.parts.map((part) => {
      if (!isToolUIPart(part) || part.state !== "approval-responded") return part;
      const row = claimed.get(part.approval.id);
      const bound =
        row !== undefined &&
        !kept.has(row.id) &&
        row.tool_call_id === part.toolCallId &&
        row.tool_name === getToolName(part) &&
        part.approval.approved === (row.status === "approved");
      if (bound && (row.status !== "approved" || canonicalJson(part.input) === canonicalJson(row.input))) {
        kept.add(row.id);
        return part;
      }
      changed = true;
      const closed = part.approval.approved
        ? { ...part, state: "output-error", errorText: bound ? "input_mismatch" : "not_executed" }
        : { ...part, state: "output-denied" };
      return closed as unknown as UIMessage["parts"][number];
    });
    return changed ? { ...message, parts } : message;
  });
}

/**
 * Persists the turn (also when it was aborted), stores the SDK approval ids on the rows
 * recorded while the turn ran, and records the outcome of every write approved this turn.
 * Each step is attempted even if an earlier one failed.
 */
async function finishTurn(
  admin: AdminClient,
  args: { orgId: string; userId: string; conversationId: string; messages: UIMessage[]; approved: ApprovalRow[] },
): Promise<void> {
  const { orgId, userId, conversationId, messages } = args;
  try {
    await persistUiMessages(admin, { conversationId, orgId, userId, messages });
  } catch (error) {
    console.error("AI Chat: persisting the turn failed:", error);
  }
  const last = messages.findLast((m) => m.role === "assistant");
  try {
    const pairs = last ? extractApprovalRequests(last).map(({ toolCallId, approvalId }) => ({ toolCallId, approvalId })) : [];
    if (pairs.length > 0) await attachApprovalIds(admin, { orgId, conversationId, pairs });
  } catch (error) {
    console.error("AI Chat: attaching approval ids failed:", error);
  }
  for (const row of args.approved) {
    const part = last?.parts.find((p): p is ToolPart => isToolUIPart(p) && p.toolCallId === row.tool_call_id);
    const { outcome, result } = approvalOutcome(part);
    try {
      await markApprovalOutcome(admin, orgId, row.id, outcome, result);
    } catch (error) {
      console.error("AI Chat: recording an approval outcome failed:", error);
    }
  }
}

/**
 * Emits each proposed write's diff as a data-approval-diff part (keyed by toolCallId)
 * right before its approval request: ai 6 cannot carry a descriptor on the approval part
 * (see lib/ai/tools/registry.ts). An optional notice goes right after the start chunk.
 */
function decorateStream(
  stream: ReadableStream<UIMessageChunk>,
  notice: UIMessageChunk | null,
  descriptors: Map<string, FieldDiff>,
): ReadableStream<UIMessageChunk> {
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === "tool-approval-request") {
          const diff = descriptors.get(chunk.toolCallId);
          if (diff) {
            descriptors.delete(chunk.toolCallId);
            controller.enqueue({ type: "data-approval-diff", id: chunk.toolCallId, data: diff });
          }
        }
        controller.enqueue(chunk);
        if (chunk.type === "start" && notice) controller.enqueue(notice);
      },
    }),
  );
}

/**
 * The newest MAX_MODEL_MESSAGES stored messages, cut at message boundaries only (a tool
 * call and its result live inside one assistant UI message, so they are never split).
 * The window opens with a user message, and it always keeps `mustInclude`: the assistant
 * message whose approvals this turn answers.
 */
function modelWindow(messages: UIMessage[], mustInclude = -1): UIMessage[] {
  let start = Math.max(0, messages.length - MAX_MODEL_MESSAGES);
  if (mustInclude >= 0 && mustInclude < start) start = mustInclude;
  while (start < messages.length - 1 && start !== mustInclude && messages[start].role !== "user") start++;
  return messages.slice(start);
}

/** Plain user/assistant text of the stored history, for the provider without tools. */
function textHistory(messages: UIMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.flatMap((m) => {
    if (m.role !== "user" && m.role !== "assistant") return [];
    const content = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return content ? [{ role: m.role, content }] : [];
  });
}

export async function POST(req: Request) {
  let releaseRateLimit: (() => void) | null = null;
  let closeCustomFetch: (() => void) | null = null;
  let releaseLock: (() => Promise<void>) | null = null;
  /** Set once approvals are claimed, cleared once a stream owns them: marks the unexecuted ones failed. */
  let failClaimed: ((reason: string) => Promise<void>) | null = null;
  // The turn deadline runs from the moment the request arrives, so setup time counts.
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(new Error("turn_deadline")), TURN_DEADLINE_MS);
  /** Ends a request before anything was acquired. */
  const end = (response: Response) => {
    clearTimeout(deadlineTimer);
    return response;
  };
  /** Ends a request that will not stream: fails claimed approvals, frees the slot, the pinned fetch and the turn lock. */
  const reject = async (status: number, body: Record<string, unknown>) => {
    clearTimeout(deadlineTimer);
    await failClaimed?.(String(body.error ?? "rejected"));
    releaseRateLimit?.();
    closeCustomFetch?.();
    await releaseLock?.();
    return Response.json(body, { status });
  };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return end(new Response("Unauthorized", { status: 401 }));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return end(new Response("No organization found", { status: 400 }));
    }

    // Get AI settings for API key (secret columns are only readable with the service role)
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("ai_settings")
      .select(
        "organization_id, api_key, feature_chat, ai_provider, openrouter_api_key, openrouter_oauth_token, openrouter_expires_at, openai_api_key, groq_api_key, ollama_base_url, custom_base_url, custom_api_key, custom_model, custom_fast_model, daily_token_limit, monthly_token_limit, tokens_used_today, tokens_used_month, last_token_reset_daily, last_token_reset_monthly, copilot_always_allow"
      )
      .eq("organization_id", profile.organization_id)
      .single();

    if (settings && !settings.feature_chat) {
      return end(new Response("AI Chat is disabled in settings", { status: 403 }));
    }

    const limitReason = settings ? tokenLimitReason(settings) : null;
    if (limitReason) {
      return end(Response.json({ error: limitReason }, { status: 429 }));
    }

    const notConfigured = () =>
      end(
        new Response("AI isn't set up for this workspace yet. Add a provider in Settings → AI Assistant.", {
          status: 400,
        })
      );
    const resolved = resolveAIProvider(settings ?? {}, process.env);
    if (!resolved) return notConfigured();
    const provider = resolved.provider;

    // Model for the streaming (Anthropic protocol) branch below.
    let modelId: string;
    switch (provider) {
      case "custom": {
        // The env fallback uses its own models, never the org's custom_* fields.
        const customModel = customModelFor("sonnet", customModelSettingsFor(resolved, settings) ?? {});
        if (!customModel || !resolved.baseURL) return notConfigured();
        // Without a key the SDK would fall back to ANTHROPIC_API_KEY from env.
        if (!resolved.apiKey) return notConfigured();
        modelId = customModel;
        break;
      }
      case "openrouter":
        modelId = "anthropic/claude-sonnet-4-6";
        break;
      default:
        modelId = "claude-sonnet-4-6";
    }
    const toolsSupported = TOOL_PROVIDERS.has(provider);

    const orgId = profile.organization_id;
    const userId = user.id;
    // The owner's shared (env) key is limited per workspace and site-wide per
    // UTC day, and guests (anonymous users) also share a smaller guest pool:
    // tokens are reserved before each call (below, per step, or in the client
    // for the OpenAI-compatible branch). Refusals are plain text so the chat
    // UI shows the reason as is.
    const sharedKey = resolved.source === "env";
    const isGuest = user.is_anonymous === true;

    const rateCheck = checkRateLimit(orgId);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 1000) / 1000);
      return end(
        Response.json(
          { error: `Rate limit exceeded. Please try again in ${retryAfterSec} seconds.` },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        )
      );
    }
    const release = acquireRateLimit(orgId);
    let released = false;
    const guardedRelease = () => {
      if (released) return;
      released = true;
      release();
    };
    releaseRateLimit = guardedRelease;
    // On the shared key the call runs to completion after a disconnect (so its
    // real usage is settled); the slot is freed when it ends, not on abort.
    if (!sharedKey) req.signal.addEventListener("abort", guardedRelease);

    // ── Request body: one human action, never history ─────────────────────
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return reject(400, { error: "invalid_request" });
    }
    const parsed = chatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return reject(400, {
        error: "invalid_request",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const body = parsed.data;
    // Approvals continue the last assistant message; a new message starts a new one.
    // The SDK can only run approved tools when the approvals are the newest input.
    if (body.message && body.approvals.length > 0) return reject(400, { error: "approvals_with_message" });
    if (!body.message && body.approvals.length === 0) return reject(400, { error: "empty_turn" });
    if (!toolsSupported && body.approvals.length > 0) return reject(400, { error: "no_tools" });

    let anthropicOptions: Parameters<typeof createAnthropic>[0] = { apiKey: resolved.apiKey };
    if (provider === "custom" && resolved.baseURL) {
      // SECURITY: the resolved URL (the org's, or the env fallback's, always
      // paired with its own key) goes through a fetch pinned to the validated
      // public addresses. Closed exactly once when the
      // stream finishes, errors, or the client disconnects.
      let pinned: Awaited<ReturnType<typeof createCustomFetch>>;
      try {
        pinned = await createCustomFetch(resolved.baseURL);
      } catch (err) {
        guardedRelease();
        return end(new Response(err instanceof Error ? err.message : "Custom AI base URL is not allowed", { status: 400 }));
      }
      let fetchClosed = false;
      const guardedClose = () => {
        if (fetchClosed) return;
        fetchClosed = true;
        pinned.close().catch((err) => console.error("AI Chat: closing custom fetch failed:", err));
      };
      closeCustomFetch = guardedClose;
      if (!sharedKey) req.signal.addEventListener("abort", guardedClose);
      anthropicOptions = {
        apiKey: resolved.apiKey,
        baseURL: aiSdkBaseUrl(pinned.base),
        fetch: pinned.fetch,
      };
    } else if (provider === "openrouter") {
      anthropicOptions = {
        apiKey: resolved.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-crm-weld.vercel.app",
          "X-Title": "Pulse CRM",
        },
      };
    }

    // ── Conversation, turn lock, server-owned history ─────────────────────
    const conversation = await getOrCreateConversation(admin, {
      orgId,
      userId,
      conversationId: body.conversationId ?? null,
      pageKey: body.pageKey ?? null,
      title: body.message?.text.slice(0, 60),
    });
    if ("error" in conversation) return reject(404, { error: "conversation_not_found" });
    const conversationId = conversation.id;

    const lockToken = await acquireTurnLock(admin, { conversationId, orgId });
    if (!lockToken) return reject(409, { error: "turn_in_progress" });
    let lockReleased = false;
    releaseLock = async () => {
      if (lockReleased) return;
      lockReleased = true;
      try {
        await releaseTurnLock(admin, { conversationId, orgId, token: lockToken });
      } catch (error) {
        console.error("AI Chat: releasing the turn lock failed:", error);
      }
    };

    let history = await loadUiMessages(admin, conversationId, orgId);

    // A new message is stored BEFORE the model runs, so a failed turn still keeps it.
    if (body.message) {
      const userMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: body.message.text }],
      };
      await persistUserMessage(admin, { conversationId, orgId, userId, message: userMessage, seq: history.length });
      history = [...history, userMessage];
    }

    // ── System prompt: base + page context + workspace memory ─────────────
    // Built before any approval is claimed: a failure here leaves every card pending.
    const contextStr = body.context ? await assembleContext(body.context, orgId) : "";
    const memory = await loadMemoryBlock(supabase, orgId, MEMORY_CAP_TOKENS);
    const fullName = user.user_metadata?.full_name;
    const userLabel = (typeof fullName === "string" && fullName) || user.email;
    const systemMessage = `${SYSTEM_PROMPTS.chat}
${contextStr ? `\n---\nCurrent CRM Context:\n${contextStr}` : ""}
${memory.text ? `\n---\n${memory.text}` : ""}

Current date: ${new Date().toLocaleDateString()}${userLabel ? `\nUser: ${userLabel}` : ""}`;

    // The answered assistant message (approval turns) always stays in the model window.
    const answered = body.approvals.length > 0 ? history.findLastIndex((m) => m.role === "assistant") : -1;

    // Shared key: reserve per step. The first step (input plus one output cap) is reserved
    // here, before any approval is claimed, so a refusal leaves every card pending. Each
    // further step is reserved by stopWhen before it runs, with the input it will resend,
    // and a refusal ends the turn with what exists. onFinish settles every reservation to
    // real usage (onAbort, after the deadline, the finished steps'); a failed stream keeps
    // them in full. The base input is the system prompt (memory block included) plus the
    // trimmed history with this request's answers applied, as the model will be sent it.
    let turnBudget: ReturnType<typeof sharedTurnBudget> | null = null;
    if (sharedKey && toolsSupported) {
      const answeredHistory = applyApprovalResponses(history, body.approvals).messages;
      const estimateMessages = await convertToModelMessages(modelWindow(answeredHistory, answered), {
        ignoreIncompleteToolCalls: true,
      });
      turnBudget = sharedTurnBudget({
        orgId,
        isGuest,
        baseInput: systemMessage + JSON.stringify(estimateMessages),
        maxOutputTokens: SHARED_CHAT_MAX_OUTPUT_TOKENS,
        maxSteps: CHAT_MAX_STEPS,
      });
      const first = await turnBudget.start();
      if (!first.ok) return reject(429, { error: first.reason });
    }

    // Approvals: each one is claimed atomically before anything runs. Unknown, repeated
    // or already-resolved ids never execute. One bad id does not void the valid ones.
    // Until a stream owns them, a failure marks the claimed, approved rows failed.
    const claimed: ClaimedApproval[] = [];
    const resolvedRowIds = new Set<string>();
    failClaimed = async (reason) => {
      for (const c of claimed) {
        if (!c.response.approved || resolvedRowIds.has(c.row.id)) continue;
        try {
          await markApprovalOutcome(admin, orgId, c.row.id, "failed", { error: reason });
          resolvedRowIds.add(c.row.id);
        } catch (error) {
          console.error("AI Chat: failing a claimed approval failed:", error);
        }
      }
    };
    const { invalid } = await claimApprovals(admin, { orgId, conversationId, approvals: body.approvals }, claimed);
    const applied = applyApprovalResponses(history, claimed.map((c) => c.response));
    const unmatched = new Set(applied.unmatched);
    for (const c of claimed.filter((c) => unmatched.has(c.response.approvalId))) {
      // Claimed, but its card is no longer in the latest turn: it can never run.
      invalid.push(c.response.approvalId);
      if (c.response.approved) {
        await markApprovalOutcome(admin, orgId, c.row.id, "failed", { error: "approval_not_in_latest_turn" });
        // Only once recorded: if that write throws, failClaimed (catch path) still covers the row.
        resolvedRowIds.add(c.row.id);
      }
    }
    const matched = claimed.filter((c) => !unmatched.has(c.response.approvalId));
    if (body.approvals.length > 0 && matched.length === 0) {
      return reject(400, { error: "invalid_approval", approvalId: invalid[0] });
    }
    const approvedRows = matched.filter((c) => c.response.approved).map((c) => c.row);
    // Only this request's claimed approvals may execute (see closeUnclaimedApprovals).
    history = closeUnclaimedApprovals(applied.messages, new Map(matched.map((c) => [c.response.approvalId, c.row])));

    // The model sees a window of the stored history; the stream and persistence keep all of it.
    const modelHistory = modelWindow(history, matched.length > 0 ? answered : -1);

    const startTime = Date.now();
    let resolveTurnDone: () => void = () => undefined;
    const turnDone = new Promise<void>((resolve) => {
      resolveTurnDone = resolve;
    });
    // Runs once per turn, from the UI stream's onFinish (also on abort or client disconnect).
    const onTurnFinish = async ({ messages }: { messages: UIMessage[] }) => {
      try {
        await finishTurn(admin, { orgId, userId, conversationId, messages, approved: approvedRows });
      } finally {
        clearTimeout(deadlineTimer);
        guardedRelease();
        closeCustomFetch?.();
        await releaseLock?.();
        resolveTurnDone();
      }
    };
    const invalidNotice: UIMessageChunk | null =
      invalid.length > 0
        ? {
            type: "data-notice",
            data: { code: "invalid_approval", approvalIds: invalid, message: "Some approvals were already resolved or unknown and were skipped." },
          }
        : null;
    const headers = { "x-conversation-id": conversationId };
    // A server-side copy of the SSE stream is always read to the end, so onFinish
    // (persistence, outcomes, lock release) runs even when the client disconnects.
    const consumeSseStream = ({ stream }: { stream: ReadableStream<string> }) => {
      void consumeStream({ stream, onError: (error) => console.error("AI Chat stream error:", error) });
    };

    if (!toolsSupported) {
      // OpenAI-compatible providers (OpenAI, Groq, Ollama): one completion
      // without CRM tools, delivered as a notice plus a single text part.
      const client = createAIMessagesClient(resolved, null, orgId, isGuest);
      const chatMessages = textHistory(modelHistory);
      const stream = createUIMessageStream({
        originalMessages: history,
        generateId: () => crypto.randomUUID(),
        execute: async ({ writer }) => {
          writer.write({ type: "start" });
          writer.write({ type: "data-notice", data: { code: "no_tools", message: NO_TOOLS_NOTICE } });
          try {
            const completion = client.messages.create({
              model: getModelId("sonnet", provider),
              max_tokens: 4096,
              system: systemMessage,
              messages: chatMessages,
            });
            // The shared-key settlement runs inside the completion
            // (lib/ai/client.ts): keep the function alive for it even if the
            // client disconnects.
            after(() => completion.then(() => undefined, () => undefined));
            const response = await completion;
            const text = response.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
            const id = crypto.randomUUID();
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: text });
            writer.write({ type: "text-end", id });
            writer.write({ type: "finish" });
            await logTokenUsage({
              orgId,
              userId,
              feature: "chat",
              model: response.model,
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              durationMs: Date.now() - startTime,
              success: true,
              sharedKey,
              metadata: { provider },
            });
          } finally {
            guardedRelease();
          }
        },
        onError: chatErrorText,
        onFinish: onTurnFinish,
      });
      after(() => turnDone);
      return createUIMessageStreamResponse({ stream, headers, consumeSseStream });
    }

    const anthropic = createAnthropic(anthropicOptions);

    // Tools run on the user's RLS client with explicit org predicates; the admin client
    // never reaches the registry. Each proposed write is recorded as a pending approval
    // the moment needsApproval resolves, before its card streams to the client.
    const env: CopilotToolEnv = {
      db: supabase,
      ctx: { orgId, userId, isGuest, source: "chat", conversationId, taskId: null },
    };
    const approvedDiffs = new Map(approvedRows.map((row) => [row.tool_call_id, row.diff as unknown as FieldDiff | null]));
    /** This request's proposed diffs, emitted as data-approval-diff parts by decorateStream. */
    const descriptors = new Map<string, FieldDiff>();
    const tools = buildCopilotToolSet(env, {
      alwaysAllow: sanitizeAlwaysAllow(settings?.copilot_always_allow),
      descriptors,
      onWriteRequested: async (info) => {
        await recordPendingApproval(admin, { ...info, orgId, userId, conversationId, taskId: null, source: "chat" });
      },
      resolveDiff: async (toolCallId) => approvedDiffs.get(toolCallId) ?? null,
      hasApprovalRow: async (toolCallId) => {
        const { data, error } = await admin
          .from("copilot_approvals")
          .select("id")
          .eq("organization_id", orgId)
          .eq("tool_call_id", toolCallId)
          .maybeSingle();
        // Fail closed: an unknown answer counts as an existing row, so the call never runs.
        if (error) console.error("AI Chat: approval row lookup failed:", error.message);
        return Boolean(data) || Boolean(error);
      },
      // An always-allowed write leaves an audit row with its outcome.
      onAutoAllowed: async ({ toolCallId, toolName, input, diff, result }) => {
        try {
          const { error } = await admin.from("copilot_approvals").insert({
            organization_id: orgId,
            user_id: userId,
            conversation_id: conversationId,
            task_id: null,
            source: "chat",
            tool_call_id: toolCallId,
            tool_name: toolName,
            input: (input ?? null) as Json,
            diff: diff as unknown as Json,
            status: resultOutcome(result),
            result: (result ?? null) as Json,
            resolved_at: new Date().toISOString(),
          });
          if (error) console.error("AI Chat: recording an always-allowed write failed:", error.message);
        } catch (error) {
          console.error("AI Chat: recording an always-allowed write failed:", error);
        }
      },
    });
    // Only server-loaded history reaches the model. Unanswered approval cards and
    // interrupted tool calls are dropped (ignoreIncompleteToolCalls).
    const modelMessages = await convertToModelMessages(modelHistory, { tools, ignoreIncompleteToolCalls: true });

    let streamFailed = false;
    let abortSettled: Promise<void> = Promise.resolve();

    const result = streamText({
      // The custom relay drops streamed responses that carry tool calls, so it is
      // called with plain request/response and the result is replayed as a stream.
      model:
        provider === "custom"
          ? wrapLanguageModel({ model: anthropic(modelId), middleware: simulateStreamingMiddleware() })
          : anthropic(modelId),
      system: systemMessage,
      messages: modelMessages,
      tools,
      ...(sharedKey ? { maxOutputTokens: SHARED_CHAT_MAX_OUTPUT_TOKENS } : {}),
      stopWhen: turnBudget ? turnBudget.stopWhen : stepCountIs(CHAT_MAX_STEPS),
      // The shared key never forwards the client's abort: the provider call
      // finishes so onFinish can settle the real usage. Every turn is cut off
      // at the internal deadline, which aborts the stream (onAbort).
      abortSignal: sharedKey ? deadline.signal : AbortSignal.any([req.signal, deadline.signal]),
      onAbort: ({ steps }) => {
        guardedRelease();
        closeCustomFetch?.();
        // Settle the steps that finished; the unfinished step's reservation
        // stands in full. Awaited by the after() below.
        if (turnBudget) abortSettled = turnBudget.settle(steps);
      },
      onError: ({ error }) => {
        streamFailed = true;
        guardedRelease();
        closeCustomFetch?.();
        console.error("AI Chat stream error:", describeProviderError(error));
      },
      onFinish: async ({ totalUsage, steps }) => {
        guardedRelease();
        closeCustomFetch?.();
        const durationMs = Date.now() - startTime;
        if (turnBudget && !streamFailed) await turnBudget.settle(steps);
        await logTokenUsage({
          orgId,
          userId,
          feature: "chat",
          model: modelId,
          inputTokens: totalUsage?.inputTokens || 0,
          outputTokens: totalUsage?.outputTokens || 0,
          durationMs,
          success: true,
          sharedKey,
        });
      },
    });

    // Always read the model stream to the end on the server, even if the client
    // goes away, and keep the function alive until onFinish (or onAbort) and the
    // turn's persistence have run.
    const consumed = Promise.resolve(
      result.consumeStream({ onError: (error) => console.error("AI Chat stream error:", describeProviderError(error)) })
    ).finally(() => {
      guardedRelease();
      closeCustomFetch?.();
    });
    after(() => consumed.then(() => abortSettled).then(() => turnDone));

    const stream = createUIMessageStream({
      originalMessages: history,
      generateId: () => crypto.randomUUID(),
      execute: ({ writer }) => {
        writer.merge(decorateStream(result.toUIMessageStream({ onError: chatErrorText }), invalidNotice, descriptors));
      },
      onError: chatErrorText,
      onFinish: onTurnFinish,
    });
    // From here the turn's onFinish (finishTurn) records every claimed approval's outcome.
    failClaimed = null;
    return createUIMessageStreamResponse({ stream, headers, consumeSseStream });
  } catch (error) {
    clearTimeout(deadlineTimer);
    await failClaimed?.("request_failed");
    releaseRateLimit?.();
    closeCustomFetch?.();
    await releaseLock?.();
    console.error("AI Chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
