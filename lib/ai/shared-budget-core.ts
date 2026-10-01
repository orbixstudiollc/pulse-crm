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

/** The most output tokens one shared-key call may ask for; larger requests are clamped. */
export const SHARED_MAX_OUTPUT_TOKENS = 8192;

/**
 * Tokens to reserve before a shared-key call: about one token per 3 input
 * characters (rounded up) plus the most the model may write.
 */
export function estimateTokens(input: { inputChars: number; maxOutputTokens: number }): number {
  return Math.ceil(input.inputChars / 3) + input.maxOutputTokens;
}

/**
 * The user-facing refusal for a reserve_shared_ai_tokens result, or null when
 * the tokens were reserved. Anything unexpected refuses (fail closed).
 */
export function reservationReason(result: unknown): string | null {
  if (result === "ok") return null;
  if (result === "org_limit") return SHARED_BUDGET_WORKSPACE_REASON;
  return SHARED_BUDGET_BUSY_REASON;
}

/**
 * The correction to apply once a call's actual usage is known: actual minus
 * reserved, never a refund larger than the reservation (settle also changes
 * the shared site counter). null when usage is unknown (not a positive
 * finite number; every real call uses at least one token), so the
 * reservation stands.
 */
export function settlementDelta(reserved: number, actualTotal: number | null | undefined): number | null {
  if (typeof actualTotal !== "number" || !Number.isFinite(actualTotal) || actualTotal <= 0) return null;
  return Math.max(actualTotal - reserved, -reserved);
}

/** The UTC day of `now` as YYYY-MM-DD, the day the budget rows are kept under. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
