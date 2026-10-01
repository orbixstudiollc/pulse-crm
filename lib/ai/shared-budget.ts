import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  SHARED_BUDGET_BUSY_REASON,
  sharedBudgetDecision,
  sharedBudgetLimits,
  utcDayStart,
  type SharedBudgetDecision,
} from "./shared-budget-core";

/** PostgREST returns at most 1000 rows per request, so totals are read in pages. */
const PAGE_SIZE = 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Shared-key tokens logged since `since` (for one org, or site-wide), read
 * until the total reaches `cap` or the rows run out. Throws on a query error.
 */
async function sharedTokensSince(
  admin: AdminClient,
  since: string,
  cap: number,
  orgId?: string
): Promise<number> {
  let total = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from("ai_usage_log")
      .select("total_tokens")
      .eq("metadata->>shared_key", "true")
      .gte("created_at", since);
    if (orgId) query = query.eq("organization_id", orgId);
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const row of page) total += row.total_tokens ?? 0;
    if (total >= cap || page.length < PAGE_SIZE) return total;
  }
}

/**
 * Whether `orgId` may make another AI call on the shared (env) key today.
 * Counts ai_usage_log rows marked metadata.shared_key since midnight UTC, for
 * the org and site-wide. Fails closed: any error blocks with the busy reason.
 */
export async function checkSharedBudget(
  orgId: string,
  now: Date = new Date()
): Promise<SharedBudgetDecision> {
  try {
    const admin = createAdminClient();
    const since = utcDayStart(now).toISOString();
    const { orgLimit, siteLimit } = sharedBudgetLimits(process.env);
    const [orgTokensToday, siteTokensToday] = await Promise.all([
      sharedTokensSince(admin, since, orgLimit, orgId),
      sharedTokensSince(admin, since, siteLimit),
    ]);
    return sharedBudgetDecision({ orgTokensToday, siteTokensToday, orgLimit, siteLimit });
  } catch (error) {
    console.error("[shared-budget] usage check failed:", error instanceof Error ? error.message : error);
    return { allowed: false, reason: SHARED_BUDGET_BUSY_REASON };
  }
}

/** The signed-in user, else the workspace's first member (background jobs have no session). */
async function usageUserId(admin: AdminClient, orgId: string): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (user) return user.id;
  } catch {
    // No request scope (cron/worker): fall through to a workspace member.
  }
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Logs a successful shared-key call made outside lib/ai/client.ts (Lead
 * Finder) to ai_usage_log, marked metadata.shared_key, so checkSharedBudget
 * counts it. Never throws.
 */
export async function recordSharedUsage(params: {
  orgId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  provider: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const userId = await usageUserId(admin, params.orgId);
    if (!userId) {
      console.error("[shared-budget] no user to attribute shared AI usage to; not logged");
      return;
    }
    const { error } = await admin.from("ai_usage_log").insert({
      organization_id: params.orgId,
      user_id: userId,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      duration_ms: params.durationMs,
      success: true,
      metadata: { provider: params.provider, shared_key: true },
    });
    if (error) console.error("[shared-budget] logging shared AI usage failed:", error.message);
  } catch (error) {
    console.error("[shared-budget] logging shared AI usage failed:", error instanceof Error ? error.message : error);
  }
}
