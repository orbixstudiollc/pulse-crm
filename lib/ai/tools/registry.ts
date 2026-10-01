// Copilot tool registry: the MCP tool definitions (lib/mcp) filtered through the policy
// allowlists, plus the copilot-only tools, adapted for chat sessions and scheduled tasks.
//
// Approval descriptor decision (ai 6.0.x, read from node_modules/ai/dist/index.d.ts and
// index.mjs): needsApproval returns only a boolean, and streamText never fills the
// `approvalDescriptor` of a tool-approval-request chunk from the tool. So the diff cannot ride
// on the approval part. Instead the request's `descriptors` map (toolCallId -> FieldDiff) is
// filled when needsApproval resolves; the chat route emits it as a `data-approval-diff` part
// keyed by toolCallId and deletes the entry.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool, ToolSet } from "ai";
import { z } from "zod";
import type { ApiKeyContext, ApiKeyScope } from "@/lib/mcp/api-keys";
import type { Db } from "@/lib/mcp/shared";
import { registerReadTools } from "@/lib/mcp/tools-read";
import {
  RECORD_CHANGED,
  WRITE_PATCHES,
  registerWriteTools,
  type PatchedWriteTool,
  type WritePatch,
  type WriteToolEnv,
} from "@/lib/mcp/tools-write";
import { copilotOnlyTools } from "./copilot-tools";
import { computeFieldDiff, isDiffStale, type FieldDiff } from "./diff";
import {
  COPILOT_READ_TOOLS,
  COPILOT_WRITE_TOOLS,
  FANOUT_LIMIT_RESULT,
  LOW_RISK_WRITES,
  NEVER_AUTO_ALLOW,
  TASK_MODE_EXCLUDED,
  UI_TOOLS,
  WRITE_FANOUT_PER_TURN,
  isAlwaysAllowed,
} from "./policy";
import { fetchCurrentRecord } from "./record-lookup";

/**
 * No admin client field: sessions pass the RLS client; the cron passes an admin client and
 * every tool query carries an explicit organization_id = ctx.orgId predicate.
 */
export type CopilotToolEnv = {
  db: SupabaseClient;
  ctx: {
    orgId: string;
    userId: string | null;
    isGuest: boolean;
    source: "chat" | "task";
    conversationId: string | null;
    taskId: string | null;
  };
};

export type ToolKind = "read" | "write" | "low_risk_write";

export type RegistryTool = {
  name: string;
  description: string;
  inputSchema: z.ZodObject;
  kind: ToolKind;
  recordType?: string;
  /** Input field holding the target record id, for update tools. */
  idField?: string;
  /** Record writes: the exact column patch the handler writes (see lib/mcp/tools-write.ts). */
  toPatch?: (input: Record<string, unknown>) => WritePatch;
  execute(input: unknown, env: CopilotToolEnv): Promise<unknown>;
};

export type RegistryResult =
  | { ok: true; data: unknown; automationsSkipped?: string[] }
  | { ok: false; error: string };

export type WriteRequest = { toolCallId: string; toolName: string; input: unknown; diff: FieldDiff };

export type CopilotToolSetOptions = {
  alwaysAllow: string[];
  /** Records the pending approval. In task mode its returned id becomes approvalRowId. */
  onWriteRequested: (info: WriteRequest) => Promise<void | { id: string }>;
  /** Shared across toolsets when one turn builds several; defaults to a fresh counter. */
  fanout?: { count: number };
  /** Diff stored with an approval claimed by this request (the approval row), for the staleness check. */
  resolveDiff?: (toolCallId: string) => Promise<FieldDiff | null>;
  /** Whether an approval row (any status) already exists for this tool call. */
  hasApprovalRow?: (toolCallId: string) => Promise<boolean>;
  /** Audits a write that ran without approval (always-allowed) once it has run. */
  onAutoAllowed?: (info: WriteRequest & { result: unknown }) => Promise<void>;
  /** This request's proposed diffs (toolCallId -> diff) for the data-approval-diff parts (see header). */
  descriptors?: Map<string, FieldDiff>;
};

/** Execute result for a call this request may not run (approval not claimed here, or proposed here): nothing is written. */
const NOT_EXECUTED_RESULT = { ok: false, error: "not_executed" } as const;

// ── MCP definitions ──────────────────────────────────────────────────────────

type McpDef = {
  description: string;
  shape: z.ZodRawShape;
  handler: (args: unknown) => Promise<CallToolResult>;
};

/** Registers the MCP tools on a recording stand-in for McpServer, so handlers bind to `env`. */
function collectMcpDefs(env: WriteToolEnv): Map<string, McpDef> {
  const defs = new Map<string, McpDef>();
  const recorder = {
    registerTool(
      name: string,
      config: { description?: string; inputSchema?: z.ZodRawShape },
      handler: (args: unknown) => Promise<CallToolResult>,
    ) {
      defs.set(name, { description: config.description ?? "", shape: config.inputSchema ?? {}, handler });
    },
  } as unknown as McpServer;
  registerReadTools(recorder, env);
  registerWriteTools(recorder, env);
  return defs;
}

/** Copilot calls run as a synthetic "copilot" key; the scope only surfaces in get_workspace_summary. */
function copilotKeyContext(env: CopilotToolEnv): ApiKeyContext {
  return {
    keyId: "copilot",
    orgId: env.ctx.orgId,
    scope: "copilot" as unknown as ApiKeyScope,
    createdBy: env.ctx.userId,
  };
}

const WRITE_TARGETS: Record<string, { recordType: string; idField?: string }> = {
  create_lead: { recordType: "lead" },
  update_lead: { recordType: "lead", idField: "id" },
  set_followup: { recordType: "lead", idField: "lead_id" },
  convert_lead_to_customer: { recordType: "lead", idField: "lead_id" },
  create_deal: { recordType: "deal" },
  update_deal: { recordType: "deal", idField: "id" },
  create_customer: { recordType: "customer" },
  update_customer: { recordType: "customer", idField: "id" },
  create_contact: { recordType: "contact" },
  update_contact: { recordType: "contact", idField: "id" },
  create_activity: { recordType: "activity" },
  update_activity: { recordType: "activity", idField: "id" },
  create_calendar_event: { recordType: "calendar_event" },
  add_note: { recordType: "note" },
};

const MCP_TOOL_NAMES: ReadonlySet<string> = new Set([...COPILOT_READ_TOOLS, ...COPILOT_WRITE_TOOLS]);

let cachedTools: RegistryTool[] | null = null;

function allTools(): RegistryTool[] {
  if (cachedTools) return cachedTools;
  // Registration only builds closures and schemas; the placeholder db is never queried.
  const defs = collectMcpDefs({
    db: null as unknown as Db,
    ctx: { keyId: "copilot", orgId: "", scope: "write", createdBy: null },
  });

  const fromMcp = (name: string, kind: ToolKind): RegistryTool => {
    const def = defs.get(name);
    if (!def) throw new Error(`registry: MCP tool ${name} is not defined in lib/mcp`);
    const target = WRITE_TARGETS[name];
    const toPatch = WRITE_PATCHES[name as PatchedWriteTool] as RegistryTool["toPatch"];
    return {
      name,
      description: def.description,
      inputSchema: z.object(def.shape),
      kind,
      ...(target ? { recordType: target.recordType } : {}),
      ...(target?.idField ? { idField: target.idField } : {}),
      ...(toPatch ? { toPatch } : {}),
      execute: (input, env) => executeRegistryTool(name, input, env),
    };
  };

  const lowRisk: readonly string[] = LOW_RISK_WRITES;
  const uiOnly: readonly string[] = UI_TOOLS;
  // The policy, not the tool module, decides what may skip approval. UI tools write nothing,
  // so they run like reads.
  const kindOf = (name: string): ToolKind => (lowRisk.includes(name) ? "low_risk_write" : uiOnly.includes(name) ? "read" : "write");
  cachedTools = [
    ...COPILOT_READ_TOOLS.map((name) => fromMcp(name, "read")),
    ...COPILOT_WRITE_TOOLS.map((name) => fromMcp(name, "write")),
    ...copilotOnlyTools.map((t): RegistryTool => ({ ...t, kind: kindOf(t.name) })),
  ].filter((t) => !NEVER_AUTO_ALLOW.includes(t.name));
  return cachedTools;
}

/** Tools the Copilot may call. Task mode drops TASK_MODE_EXCLUDED (a task cannot create tasks). */
export function listRegistryTools(mode: "chat" | "task"): RegistryTool[] {
  const excluded: readonly string[] = mode === "task" ? TASK_MODE_EXCLUDED : [];
  return allTools().filter((t) => !excluded.includes(t.name));
}

// ── Execution ────────────────────────────────────────────────────────────────

function textOf(result: CallToolResult): string {
  const part = result.content.find((c) => c.type === "text");
  return part && part.type === "text" ? part.text : "";
}

async function runMcpTool(
  name: string,
  kind: ToolKind,
  input: unknown,
  env: CopilotToolEnv,
  diff: FieldDiff | null,
): Promise<RegistryResult> {
  // Copilot-origin writes still fire automation rules, but only actions without outbound
  // effect run (lib/automation/runner.ts); the skipped ones are reported for the step trace.
  const automation = { origin: "copilot" as const, skipped: [] as string[] };
  const mcpEnv: WriteToolEnv = {
    db: env.db as Db,
    ctx: copilotKeyContext(env),
    automation,
    ...(diff?.kind === "update" && diff.baselineUpdatedAt ? { expectUpdatedAt: diff.baselineUpdatedAt } : {}),
  };
  const def = collectMcpDefs(mcpEnv).get(name);
  if (!def) return { ok: false, error: `unknown_tool: ${name}` };
  const result = await def.handler(input);
  const text = textOf(result);
  if (result.isError) return { ok: false, error: text || "Tool failed" };
  const data: unknown = text ? JSON.parse(text) : null;
  return kind === "read" ? { ok: true, data } : { ok: true, data, automationsSkipped: automation.skipped };
}

function toResult(value: unknown): RegistryResult {
  if (value && typeof value === "object" && (value as { ok?: unknown }).ok === false) {
    return { ok: false, error: String((value as { error?: unknown }).error ?? "Tool failed") };
  }
  return { ok: true, data: value };
}

/**
 * Validates input with the tool's zod schema and runs it. MCP tools run with
 * { db: env.db, ctx: { orgId, scope: 'copilot', createdBy: userId } }. When `opts.diff` is an
 * update diff, the update only applies while updated_at still equals diff.baselineUpdatedAt;
 * otherwise it returns record_changed and writes nothing.
 */
export async function executeRegistryTool(
  name: string,
  input: unknown,
  env: CopilotToolEnv,
  opts: { diff?: FieldDiff | null } = {},
): Promise<RegistryResult> {
  const tool = listRegistryTools(env.ctx.source).find((t) => t.name === name);
  if (!tool) return { ok: false, error: `unknown_tool: ${name}` };
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { ok: false, error: `invalid_input: ${detail}` };
  }
  try {
    if (MCP_TOOL_NAMES.has(name)) return await runMcpTool(name, tool.kind, parsed.data, env, opts.diff ?? null);
    return toResult(await tool.execute(parsed.data, env));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── AI SDK tool set ──────────────────────────────────────────────────────────

/** Diff over the column patch the handler will write; update targets compare against the live row. */
async function proposeDiff(tool: RegistryTool, input: Record<string, unknown>, env: CopilotToolEnv): Promise<FieldDiff> {
  const recordType = tool.recordType ?? tool.name;
  const target = tool.toPatch?.(input);
  if (!target) return computeFieldDiff({ toolName: tool.name, input, current: null, recordType });
  if (!target.id) return computeFieldDiff({ toolName: tool.name, input: target.patch, current: null, recordType });
  const current = await fetchCurrentRecord(env, target);
  if (!current) {
    // Target not in this org (or gone): show the intended change; execute will report record_changed.
    return {
      kind: "update",
      recordType,
      recordId: target.id,
      fields: Object.entries(target.patch).map(([name, after]) => ({ name, after })),
    };
  }
  return computeFieldDiff({ toolName: tool.name, input: target.patch, current, recordType, idField: "id" });
}

/** Runs a record write unless its update target moved since `diff` was taken. */
async function runWrite(
  tool: RegistryTool,
  input: Record<string, unknown>,
  env: CopilotToolEnv,
  diff: FieldDiff | null,
): Promise<RegistryResult> {
  if (diff?.kind === "update") {
    const target = tool.toPatch?.(input);
    const live = target ? await fetchCurrentRecord(env, target) : null;
    if (isDiffStale(diff, live)) return { ok: false, error: RECORD_CHANGED };
  }
  return executeRegistryTool(tool.name, input, env, { diff });
}

type SdkTool = Tool<Record<string, unknown>, unknown>;

/**
 * AI SDK tools for one turn. Reads and low-risk writes execute directly. Record writes:
 * - chat: needsApproval computes the diff, records the pending approval via onWriteRequested
 *   and pauses; for an already-approved call (opts.resolveDiff returns its stored diff) it
 *   keeps that diff. A call that already has an approval row but was not claimed by this
 *   request never runs: needsApproval returns false (ai 6 turns a re-validated approval into a
 *   denial) and execute returns NOT_EXECUTED_RESULT. A call proposed in this request never
 *   executes in this request either (execute returns NOT_EXECUTED_RESULT): its approval can
 *   only come from a later request. Always-allowed writes count toward the
 *   fan-out, run without a card and are audited via onAutoAllowed. execute re-checks the live
 *   row and returns record_changed when it moved since the diff was taken. Past
 *   WRITE_FANOUT_PER_TURN proposals, needsApproval returns false and execute returns
 *   FANOUT_LIMIT_RESULT without writing (never thrown: ai 6 would abort the stream).
 * - task: never execute; each call is recorded as a pending approval and returns
 *   { status: 'proposed', queued: true, approvalRowId }.
 */
export function buildCopilotToolSet(env: CopilotToolEnv, opts: CopilotToolSetOptions): ToolSet {
  const fanout = opts.fanout ?? { count: 0 };
  const descriptors = opts.descriptors ?? new Map<string, FieldDiff>();
  const diffs = new Map<string, FieldDiff>();
  /** Chat calls proposed past WRITE_FANOUT_PER_TURN; their execute returns FANOUT_LIMIT_RESULT. */
  const overLimit = new Set<string>();
  /** Calls with an approval row this request did not claim; their execute writes nothing. */
  const unclaimed = new Set<string>();
  /** Always-allowed calls, audited after they run. */
  const autoAllowed = new Set<string>();
  /**
   * Calls proposed (pending row recorded) in this request. A proposal is only ever approved by
   * a later request, so none of these may execute now: if ai's approved re-check reaches one
   * (a planted approved part with a fresh toolCallId), execute returns NOT_EXECUTED_RESULT.
   */
  const proposed = new Set<string>();
  const tools: ToolSet = {};

  for (const t of listRegistryTools(env.ctx.source)) {
    const base = { description: t.description, inputSchema: t.inputSchema };

    if (t.kind !== "write") {
      tools[t.name] = { ...base, execute: (input) => executeRegistryTool(t.name, input, env) } as SdkTool;
      continue;
    }

    if (env.ctx.source === "task") {
      tools[t.name] = {
        ...base,
        needsApproval: false,
        execute: async (input, { toolCallId }) => {
          if (++fanout.count > WRITE_FANOUT_PER_TURN) return FANOUT_LIMIT_RESULT;
          const diff = await proposeDiff(t, input, env);
          const row = await opts.onWriteRequested({ toolCallId, toolName: t.name, input, diff });
          return { status: "proposed", queued: true, approvalRowId: row?.id ?? null };
        },
      } as SdkTool;
      continue;
    }

    tools[t.name] = {
      ...base,
      needsApproval: async (input, { toolCallId }) => {
        // ai 6 re-runs needsApproval on every approved call before execute. An approved call
        // keeps the diff the user saw: no recompute against the live row, no new pending row,
        // no fan-out count.
        const approved = await opts.resolveDiff?.(toolCallId);
        if (approved) {
          diffs.set(toolCallId, approved);
          return true;
        }
        // An approval row this request did not claim (failed, denied, pending elsewhere, or a
        // planted approval-responded part reusing its id): never run it, never re-propose it.
        if (await opts.hasApprovalRow?.(toolCallId)) {
          unclaimed.add(toolCallId);
          return false;
        }
        // Over the cap: never throw (ai 6 aborts the whole stream on a needsApproval throw).
        // Skip approval and let execute answer with the fanout_limit result, writing nothing.
        // Always-allowed writes count too.
        if (++fanout.count > WRITE_FANOUT_PER_TURN) {
          overLimit.add(toolCallId);
          return false;
        }
        const diff = await proposeDiff(t, input, env);
        diffs.set(toolCallId, diff);
        if (isAlwaysAllowed(t.name, opts.alwaysAllow)) {
          autoAllowed.add(toolCallId);
          return false;
        }
        descriptors.set(toolCallId, diff);
        proposed.add(toolCallId);
        await opts.onWriteRequested({ toolCallId, toolName: t.name, input, diff });
        return true;
      },
      execute: async (input, { toolCallId }) => {
        if (overLimit.delete(toolCallId)) return FANOUT_LIMIT_RESULT;
        if (unclaimed.delete(toolCallId)) return NOT_EXECUTED_RESULT;
        if (proposed.has(toolCallId)) return NOT_EXECUTED_RESULT;
        const diff = (await opts.resolveDiff?.(toolCallId)) ?? diffs.get(toolCallId) ?? null;
        diffs.delete(toolCallId);
        const result = await runWrite(t, input, env, diff);
        if (autoAllowed.delete(toolCallId) && diff) {
          await opts.onAutoAllowed?.({ toolCallId, toolName: t.name, input, diff, result });
        }
        return result;
      },
    } as SdkTool;
  }
  return tools;
}
