/**
 * Daily token limits for AI calls paid by a server-wide (env) credential, the
 * owner's shared key. Org-owned keys are never limited by this.
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

export const SHARED_BUDGET_WORKSPACE_REASON =
  "Today's AI limit for this workspace is used up. It resets at midnight UTC.";
export const SHARED_BUDGET_BUSY_REASON = "AI is busy right now. Please try again later.";

export const DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT = 50_000;
export const DEFAULT_SHARED_DAILY_TOKEN_LIMIT = 1_000_000;

export interface SharedBudgetDecision {
  allowed: boolean;
  reason?: string;
}

/** Thrown instead of making an AI call that the shared-key budget does not allow. */
export class SharedBudgetError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SharedBudgetError";
  }
}

/** A whole, non-negative token count from env, or `fallback` when unset or invalid. */
export function parseLimit(envValue: string | undefined, fallback: number): number {
  const value = envValue?.trim();
  if (!value || !/^\d+$/.test(value)) return fallback;
  const limit = Number(value);
  return Number.isSafeInteger(limit) ? limit : fallback;
}

/** Per-workspace and site-wide daily limits. 0 means no shared AI at all. */
export function sharedBudgetLimits(env: Record<string, string | undefined>): {
  orgLimit: number;
  siteLimit: number;
} {
  return {
    orgLimit: parseLimit(env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT, DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT),
    siteLimit: parseLimit(env.AI_SHARED_DAILY_TOKEN_LIMIT, DEFAULT_SHARED_DAILY_TOKEN_LIMIT),
  };
}

/**
 * Whether one more shared-key call may start, given today's shared-key token
 * totals. The workspace limit is reported first since it is the one the user
 * can wait out.
 */
export function sharedBudgetDecision(input: {
  orgTokensToday: number;
  siteTokensToday: number;
  orgLimit: number;
  siteLimit: number;
}): SharedBudgetDecision {
  if (input.orgTokensToday >= input.orgLimit) {
    return { allowed: false, reason: SHARED_BUDGET_WORKSPACE_REASON };
  }
  if (input.siteTokensToday >= input.siteLimit) {
    return { allowed: false, reason: SHARED_BUDGET_BUSY_REASON };
  }
  return { allowed: true };
}

/** Midnight UTC at the start of `now`'s UTC day. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
