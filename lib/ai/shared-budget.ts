import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  SHARED_BUDGET_BUSY_REASON,
  SHARED_BUDGET_TOO_LARGE_REASON,
  estimateTokens,
  reservationFromRpc,
  settlementDelta,
  settlementsByDay,
  sharedBudgetLimits,
  type SharedReservation,
} from "./shared-budget-core";

type AdminClient = ReturnType<typeof createAdminClient>;

export type { SharedReservation };

/** Guest workspaces also draw from the smaller shared guest pool (migration 035). */
export type SharedPool = { isGuest: boolean };

function errorMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error;
}

/**
 * Reserves `estimate` tokens of today's shared-key budget for `orgId` before
 * an AI call on the owner's shared (env) key. The counters (migration 035)
 * are checked and charged atomically, so concurrent calls cannot all pass;
 * guests are also charged to the guest pool. Returns the UTC day the database
 * charged, for settleSharedTokens. A request larger than the workspace limit
 * itself is refused without reserving. Fails closed: any error refuses with
 * the busy reason.
 */
export async function reserveSharedTokens(
  orgId: string,
  estimate: number,
  { isGuest }: SharedPool
): Promise<SharedReservation> {
  try {
    const { orgLimit, siteLimit, guestLimit } = sharedBudgetLimits(process.env);
    if (orgLimit > 0 && estimate > orgLimit) return { ok: false, reason: SHARED_BUDGET_TOO_LARGE_REASON };
    const { data, error } = await createAdminClient().rpc("reserve_shared_ai_tokens", {
      p_org: orgId,
      p_tokens: estimate,
      p_org_limit: orgLimit,
      p_site_limit: siteLimit,
      p_is_guest: isGuest,
      p_guest_limit: guestLimit,
    });
    if (error) throw new Error(error.message);
    const reservation = reservationFromRpc(data, estimate);
    if (!reservation.ok && data?.[0]?.result === "ok") {
      console.error("[shared-budget] reservation came back without a usable day; it stands unsettled");
    }
    return reservation;
  } catch (error) {
    console.error("[shared-budget] reserving shared AI tokens failed:", errorMessage(error));
    return { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
  }
}

/**
 * Corrects a reservation to the call's actual usage (input + output tokens),
 * on the day it was charged and in the same pool. Skipped when usage is
 * unknown, so the reservation stands. Never throws.
 */
export async function settleSharedTokens(
  orgId: string,
  day: string,
  reserved: number,
  actualTotal: number | null | undefined,
  { isGuest }: SharedPool
): Promise<void> {
  const delta = settlementDelta(reserved, actualTotal);
  if (delta === null || delta === 0) return;
  try {
    const { error } = await createAdminClient().rpc("settle_shared_ai_tokens", {
      p_org: orgId,
      p_day: day,
      p_delta: delta,
      p_is_guest: isGuest,
    });
    if (error) console.error("[shared-budget] settling shared AI tokens failed:", error.message);
  } catch (error) {
    console.error("[shared-budget] settling shared AI tokens failed:", errorMessage(error));
  }
}

/**
 * Whether a shared-key call for `orgId` is a guest's. The signed-in user
 * decides when there is one (anonymous = guest). Without a session (Lead
 * Finder jobs, cron) the workspace's members decide: it is a guest's when any
 * member is an anonymous auth user (auth.admin.getUserById, as
 * lib/auth/guest-cleanup.ts does). The profile email is not used: a guest can
 * edit it. Anything that cannot be determined counts as a guest, the smaller
 * pool. Never throws.
 */
export async function sharedCallerIsGuest(orgId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (user) return user.is_anonymous === true;
  } catch {
    // No request scope (cron/worker): decide from the workspace's members.
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select("id").eq("organization_id", orgId);
    if (error || !data || data.length === 0) return true;
    const anonymous = await Promise.all(
      data.map(async (member) => {
        const { data: found, error: userError } = await admin.auth.admin.getUserById(member.id);
        // Unknown (error or no such user) counts as anonymous.
        return userError || !found.user ? true : found.user.is_anonymous === true;
      })
    );
    return anonymous.some(Boolean);
  } catch (error) {
    console.error("[shared-budget] deciding the shared AI pool failed:", errorMessage(error));
    return true;
  }
}

/** A finished streamText step (only the fields used here). */
type TurnStep = {
  response: { messages: unknown[] };
  usage?: { inputTokens?: number; outputTokens?: number };
};

/**
 * Shared-key reservations for one multi-step (tool-calling) chat turn, one
 * per step instead of every step's maximum up front:
 * - `start` reserves the first step (`baseInput` plus one output cap);
 * - `stopWhen`, the streamText stop condition, ends the turn at `maxSteps`,
 *   and otherwise reserves the next step (`baseInput` plus everything the
 *   turn has added, plus one output cap) before it runs, ending the turn
 *   cleanly when that is refused;
 * - `settle` (onFinish) corrects every reservation to its step's real usage,
 *   once per turn.
 */
export function sharedTurnBudget(params: {
  orgId: string;
  isGuest: boolean;
  /** The system prompt and the turn's messages: sent again with every step. */
  baseInput: string;
  maxOutputTokens: number;
  maxSteps: number;
}) {
  const { orgId, isGuest, baseInput, maxOutputTokens, maxSteps } = params;
  const reservations: Array<{ day: string; reserved: number }> = [];
  let settled = false;

  const reserve = async (input: string): Promise<SharedReservation> => {
    const reservation = await reserveSharedTokens(orgId, estimateTokens({ input, maxOutputTokens }), { isGuest });
    if (reservation.ok) reservations.push({ day: reservation.day, reserved: reservation.reserved });
    return reservation;
  };

  return {
    start: (): Promise<SharedReservation> => reserve(baseInput),

    stopWhen: async ({ steps }: { steps: ReadonlyArray<TurnStep> }): Promise<boolean> => {
      if (steps.length >= maxSteps) return true;
      // A step's response.messages holds everything the turn has added so far.
      const added = steps[steps.length - 1]?.response.messages ?? [];
      const next = await reserve(baseInput + JSON.stringify(added));
      return !next.ok;
    },

    settle: async (steps: ReadonlyArray<TurnStep>): Promise<void> => {
      if (settled) return;
      settled = true;
      const usages = steps.map(({ usage }) =>
        usage?.inputTokens !== undefined || usage?.outputTokens !== undefined
          ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
          : undefined
      );
      for (const { day, reserved, actual } of settlementsByDay(reservations, usages)) {
        await settleSharedTokens(orgId, day, reserved, actual, { isGuest });
      }
    },
  };
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
