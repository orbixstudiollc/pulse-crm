// Copilot tool policy: which MCP tools the Copilot may use, which writes a workspace may
// auto-approve, and per-turn limits. Pure; no supabase imports.

/** The 12 MCP read tools (lib/mcp/tools-read.ts), exposed to the Copilot by name. */
export const COPILOT_READ_TOOLS: readonly string[] = [
  "get_workspace_summary",
  "search_leads",
  "get_lead",
  "list_followups",
  "search_deals",
  "get_deal",
  "search_customers",
  "get_customer",
  "search_contacts",
  "list_activities",
  "list_calendar_events",
  "list_campaigns",
];

/**
 * Explicit allowlist of MCP write tools (lib/mcp/tools-write.ts) the Copilot may propose:
 * every write tool except delete_record and any bulk tool. A tool added to lib/mcp later is
 * not exposed until it is listed here.
 */
export const COPILOT_WRITE_TOOLS: readonly string[] = [
  "create_lead",
  "update_lead",
  "set_followup",
  "convert_lead_to_customer",
  "create_deal",
  "update_deal",
  "create_customer",
  "update_customer",
  "create_contact",
  "update_contact",
  "create_activity",
  "update_activity",
  "create_calendar_event",
  "add_note",
];

/** Copilot-only saves that execute without approval and can be undone. */
export const LOW_RISK_WRITES = ["save_artifact", "save_memory", "draft_email"] as const;

/** Never exposed to the Copilot and never auto-approved: delete_record plus every bulk_* / *_many tool in lib/mcp (none today). */
export const NEVER_AUTO_ALLOW: readonly string[] = ["delete_record"];

/** Most record-write proposals one turn may make. */
export const WRITE_FANOUT_PER_TURN = 20;

/** Tools a scheduled task run may not use (a task must not create more tasks). */
export const TASK_MODE_EXCLUDED = ["create_task"] as const;

/** Tool result for a record write proposed past WRITE_FANOUT_PER_TURN (returned, never thrown). */
export const FANOUT_LIMIT_RESULT = {
  ok: false,
  error: "fanout_limit",
  message: `Copilot can propose at most ${WRITE_FANOUT_PER_TURN} changes per turn; ask again for the rest.`,
} as const;

function isAutoAllowable(name: string): boolean {
  return COPILOT_WRITE_TOOLS.includes(name) && !NEVER_AUTO_ALLOW.includes(name);
}

/** True only when the workspace listed this tool AND it is an allowlisted, non-destructive record write. */
export function isAlwaysAllowed(toolName: string, alwaysAllow: unknown): boolean {
  if (!Array.isArray(alwaysAllow)) return false;
  if (!alwaysAllow.every((v) => typeof v === "string")) return false;
  return alwaysAllow.includes(toolName) && isAutoAllowable(toolName);
}

/** Keeps only allowlisted write-tool names, de-duplicated; anything else (including garbage JSON) is dropped. */
export function sanitizeAlwaysAllow(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const names = input.filter((v): v is string => typeof v === "string" && isAutoAllowable(v));
  return Array.from(new Set(names));
}
