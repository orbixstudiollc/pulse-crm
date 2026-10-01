import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  SHARED_BUDGET_BUSY_REASON,
  reservationReason,
  settlementDelta,
  sharedBudgetLimits,
  utcDay,
} from "./shared-budget-core";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SharedReservation =
  | { ok: true; day: string; reserved: number }
  | { ok: false; reason: string };

function errorMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error;
}

/**
 * Reserves `estimate` tokens of today's shared-key budget for `orgId` before
 * an AI call on the owner's shared (env) key. The counters (migration 035)
 * are checked and charged atomically, so concurrent calls cannot all pass.
 * Returns the UTC day the tokens were charged to, for settleSharedTokens.
 * Fails closed: any error refuses with the busy reason.
 */
export async function reserveSharedTokens(orgId: string, estimate: number): Promise<SharedReservation> {
  try {
    const admin = createAdminClient();
    const { orgLimit, siteLimit } = sharedBudgetLimits(process.env);
    // The RPC charges its own UTC day and does not return it; computed right
    // before the call so settle targets the same row.
    const day = utcDay(new Date());
    const { data, error } = await admin.rpc("reserve_shared_ai_tokens", {
      p_org: orgId,
      p_tokens: estimate,
      p_org_limit: orgLimit,
      p_site_limit: siteLimit,
    });
    if (error) throw new Error(error.message);
    const reason = reservationReason(data);
    return reason ? { ok: false, reason } : { ok: true, day, reserved: estimate };
  } catch (error) {
    console.error("[shared-budget] reserving shared AI tokens failed:", errorMessage(error));
    return { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
  }
}

/**
 * Corrects a reservation to the call's actual usage (input + output tokens).
 * Skipped when usage is unknown, so the reservation stands. Never throws.
 */
export async function settleSharedTokens(
  orgId: string,
  day: string,
  reserved: number,
  actualTotal: number | null | undefined
): Promise<void> {
  const delta = settlementDelta(reserved, actualTotal);
  if (delta === null || delta === 0) return;
  try {
    const { error } = await createAdminClient().rpc("settle_shared_ai_tokens", {
      p_org: orgId,
      p_day: day,
      p_delta: delta,
    });
    if (error) console.error("[shared-budget] settling shared AI tokens failed:", error.message);
  } catch (error) {
    console.error("[shared-budget] settling shared AI tokens failed:", errorMessage(error));
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
 * Finder) to ai_usage_log, marked metadata.shared_key, for the audit log
 * (budgets are kept by reserveSharedTokens). Never throws.
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
    console.error("[shared-budget] logging shared AI usage failed:", errorMessage(error));
  }
}
