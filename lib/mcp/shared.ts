import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Database } from "@/types/database";
import type { ApiKeyContext } from "./api-keys";

export type Db = SupabaseClient<Database>;

export interface ToolEnv {
  db: Db;
  ctx: ApiKeyContext;
}

// ── Results ──────────────────────────────────────────────────────────────────

/**
 * Drops null, undefined, "" and empty arrays/objects so responses spend the
 * model's context on data rather than blank columns.
 */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      const c = compact(v);
      if (c && typeof c === "object" && !Array.isArray(c) && Object.keys(c).length === 0) continue;
      out[k] = c;
    }
    return out as T;
  }
  return value;
}

/** Most characters one tool result's text may carry, so a single result cannot flood the model's context. */
export const MAX_RESULT_CHARS = 20_000;

const TRUNCATION_NOTE =
  `Result truncated to ${MAX_RESULT_CHARS} characters; "partial" is the start of the JSON. ` +
  "Ask for less (a smaller limit, a narrower search or one record) to see the rest.";

/**
 * Keeps a result's JSON text within MAX_RESULT_CHARS. An oversized result becomes a still-valid
 * JSON object { truncated: true, message, partial } (callers JSON.parse the text), with
 * `partial` shortened until the whole object fits.
 */
function capResultText(json: string): string {
  if (json.length <= MAX_RESULT_CHARS) return json;
  let keep = MAX_RESULT_CHARS;
  for (;;) {
    const text = JSON.stringify({ truncated: true, message: TRUNCATION_NOTE, partial: json.slice(0, keep) });
    if (text.length <= MAX_RESULT_CHARS) return text;
    keep -= text.length - MAX_RESULT_CHARS;
  }
}

export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: capResultText(JSON.stringify(compact(data))) }] };
}

export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Wraps a handler so thrown errors come back as tool errors, not protocol errors. */
export function safe<A>(handler: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Unexpected error");
    }
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const id = z.guid();
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD");

export const page = {
  limit: z.number().int().min(1).max(100).default(25).describe("Max rows to return (1-100)"),
  offset: z.number().int().min(0).default(0).describe("Rows to skip, for paging"),
};

export const DEAL_STAGES = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
export const LEAD_STATUSES = ["hot", "warm", "cold"] as const;
export const LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Event", "Google Ads", "Cold Call"] as const;
export const CUSTOMER_STATUSES = ["active", "pending", "inactive"] as const;
export const CUSTOMER_PLANS = ["enterprise", "pro", "starter", "free"] as const;
export const ACTIVITY_TYPES = ["call", "meeting", "task", "email", "note"] as const;
export const ACTIVITY_STATUSES = ["completed", "scheduled", "pending", "cancelled"] as const;
export const RELATED_TYPES = ["deal", "customer", "lead"] as const;

// ── Org-scoped lookups ───────────────────────────────────────────────────────

export type OrgTable =
  | "leads"
  | "deals"
  | "customers"
  | "contacts"
  | "activities"
  | "calendar_events";

/** Display name of a lead, deal or customer in this org, or null when it is not ours. */
export async function relatedName(
  env: ToolEnv,
  type: (typeof RELATED_TYPES)[number],
  recordId: string,
): Promise<string | null> {
  const { db, ctx } = env;
  if (type === "customer") {
    const { data } = await db
      .from("customers")
      .select("first_name, last_name")
      .eq("organization_id", ctx.orgId)
      .eq("id", recordId)
      .maybeSingle();
    return data ? `${data.first_name} ${data.last_name}`.trim() : null;
  }
  const { data } = await db
    .from(type === "lead" ? "leads" : "deals")
    .select("name")
    .eq("organization_id", ctx.orgId)
    .eq("id", recordId)
    .maybeSingle();
  return data ? (data as { name: string }).name : null;
}

export async function belongsToOrg(env: ToolEnv, table: OrgTable, recordId: string): Promise<boolean> {
  const { data } = await env.db
    .from(table)
    .select("id")
    .eq("organization_id", env.ctx.orgId)
    .eq("id", recordId)
    .maybeSingle();
  return !!data;
}

/** Author name for notes: the profile that created the API key. */
export async function authorName(env: ToolEnv): Promise<string> {
  if (!env.ctx.createdBy) return "AI assistant";
  const { data } = await env.db
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", env.ctx.createdBy)
    .maybeSingle();
  if (!data) return "AI assistant";
  return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || data.email;
}

/** Drops keys whose value is undefined so a patch only touches fields the model sent. */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
