/**
 * Daily token limits for AI calls paid by a server-wide (env) credential, the
 * owner's shared key. Org-owned keys are never limited by this.
 *
 * Plain module (no server-only imports) so it can be unit tested directly.
 */

export const SHARED_BUDGET_WORKSPACE_REASON =
  "Today's AI limit for this workspace is used up. It resets at midnight UTC.";
export const SHARED_BUDGET_BUSY_REASON = "AI is busy right now. Please try again later.";
export const SHARED_BUDGET_TOO_LARGE_REASON =
  "This request is too large for the shared AI allowance. Shorten it or add your own AI provider in Settings → AI Assistant.";

export const DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT = 50_000;
export const DEFAULT_SHARED_DAILY_TOKEN_LIMIT = 1_000_000;

/** Thrown instead of making an AI call that the shared-key budget does not allow. */
export class SharedBudgetError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SharedBudgetError";
  }
}

const warnedLimits = new Set<string>();

/**
 * A whole, non-negative token count from env. Unset or blank uses `fallback`;
 * any other value that is not a plain whole number (e.g. "20,000") is 0, so
 * shared AI stays off instead of silently using a larger default. Warns once
 * per variable, without echoing the value.
 */
export function parseLimit(envValue: string | undefined, fallback: number, name: string): number {
  const value = envValue?.trim();
  if (!value) return fallback;
  const limit = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (Number.isSafeInteger(limit)) return limit;
  if (!warnedLimits.has(name)) {
    warnedLimits.add(name);
    console.warn(`[shared-budget] ${name} is not a whole non-negative number; shared AI is off until it is fixed.`);
  }
  return 0;
}

/**
 * Per-workspace, site-wide and guest-pool daily limits. 0 means no shared AI
 * at all (for guests, when the guest limit is 0). The guest pool defaults to
 * half the site limit.
 */
export function sharedBudgetLimits(env: Record<string, string | undefined>): {
  orgLimit: number;
  siteLimit: number;
  guestLimit: number;
} {
  const siteLimit = parseLimit(
    env.AI_SHARED_DAILY_TOKEN_LIMIT,
    DEFAULT_SHARED_DAILY_TOKEN_LIMIT,
    "AI_SHARED_DAILY_TOKEN_LIMIT"
  );
  return {
    orgLimit: parseLimit(
      env.AI_SHARED_ORG_DAILY_TOKEN_LIMIT,
      DEFAULT_SHARED_ORG_DAILY_TOKEN_LIMIT,
      "AI_SHARED_ORG_DAILY_TOKEN_LIMIT"
    ),
    siteLimit,
    guestLimit: parseLimit(
      env.AI_SHARED_GUEST_DAILY_TOKEN_LIMIT,
      Math.floor(siteLimit / 2),
      "AI_SHARED_GUEST_DAILY_TOKEN_LIMIT"
    ),
  };
}

/** The most output tokens one shared-key call may ask for; larger requests are clamped. */
export const SHARED_MAX_OUTPUT_TOKENS = 8192;

/**
 * Tokens to reserve before a shared-key call: one token per 3 ASCII
 * characters of input (rounded up), one per other character (code point;
 * CJK and emoji tokenize far more densely than English), plus the most the
 * model may write.
 */
export function estimateTokens(input: { input: string; maxOutputTokens: number }): number {
  let ascii = 0;
  let other = 0;
  for (const char of input.input) {
    if (char.charCodeAt(0) < 0x80) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 3) + other + input.maxOutputTokens;
}

export type SharedReservation =
  | { ok: true; day: string; reserved: number }
  | { ok: false; reason: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The outcome of a reserve_shared_ai_tokens call, whose data is exactly one
 * row { result, day }. 'org_limit' gets the workspace reason; 'guest_limit',
 * 'site_limit' and anything unexpected get the busy reason (fail closed),
 * including 'ok' without a usable day (the reservation then stands in full).
 */
export function reservationFromRpc(data: unknown, estimate: number): SharedReservation {
  const row = Array.isArray(data) && data.length === 1 ? (data[0] as { result?: unknown; day?: unknown }) : null;
  const result = row?.result;
  if (result === "ok" && typeof row?.day === "string" && DAY_RE.test(row.day)) {
    return { ok: true, day: row.day, reserved: estimate };
  }
  if (result === "org_limit") return { ok: false, reason: SHARED_BUDGET_WORKSPACE_REASON };
  return { ok: false, reason: SHARED_BUDGET_BUSY_REASON };
}

/**
 * The correction to apply once a call's actual usage is known: actual minus
 * reserved, never a refund larger than the reservation (settle also changes
 * the shared site counter). null when usage is unknown (not a positive
 * finite number; every real call uses at least one token), so the
 * reservation stands.
 */
export function settlementDelta(reserved: number, actualTotal: number | null | undefined): number | null {
  if (!isKnownUsage(actualTotal)) return null;
  return Math.max(actualTotal - reserved, -reserved);
}

function isKnownUsage(actual: number | null | undefined): actual is number {
  return typeof actual === "number" && Number.isFinite(actual) && actual > 0;
}

/**
 * One settlement per UTC day for a multi-call turn: reservation i is matched
 * with usage i. Reservations whose usage is unknown (or missing) are left
 * out, so they stand in full.
 */
export function settlementsByDay(
  reservations: ReadonlyArray<{ day: string; reserved: number }>,
  usages: ReadonlyArray<number | null | undefined>
): Array<{ day: string; reserved: number; actual: number }> {
  const byDay = new Map<string, { day: string; reserved: number; actual: number }>();
  reservations.forEach(({ day, reserved }, i) => {
    const actual = usages[i];
    if (!isKnownUsage(actual)) return;
    const current = byDay.get(day) ?? { day, reserved: 0, actual: 0 };
    byDay.set(day, { day, reserved: current.reserved + reserved, actual: current.actual + actual });
  });
  return [...byDay.values()];
}
