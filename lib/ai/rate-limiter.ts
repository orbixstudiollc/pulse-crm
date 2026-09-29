/**
 * In-memory rate limiter for AI API calls (per-organization).
 * Limits: MAX_REQUESTS_PER_MINUTE requests per minute, MAX_CONCURRENT concurrent requests.
 *
 * NOTE: The Map below is per-instance state, so limits are best-effort only.
 * On Fluid compute (or any multi-instance deployment) each instance keeps its
 * own counters and a cold start resets them. Replacing this with a shared
 * store is out of scope here.
 */

const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_CONCURRENT = 5;

interface OrgLimits {
  timestamps: number[];
  concurrent: number;
}

const orgLimits = new Map<string, OrgLimits>();

function getOrgLimits(orgId: string): OrgLimits {
  if (!orgLimits.has(orgId)) {
    orgLimits.set(orgId, { timestamps: [], concurrent: 0 });
  }
  return orgLimits.get(orgId)!;
}

function cleanOldTimestamps(limits: OrgLimits): void {
  const oneMinuteAgo = Date.now() - 60000;
  limits.timestamps = limits.timestamps.filter((t) => t > oneMinuteAgo);
}

export function checkRateLimit(orgId: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const limits = getOrgLimits(orgId);
  cleanOldTimestamps(limits);

  // Check concurrent limit
  if (limits.concurrent >= MAX_CONCURRENT) {
    return { allowed: false, retryAfterMs: 1000 };
  }

  // Check rate limit
  if (limits.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestTimestamp = limits.timestamps[0];
    const retryAfterMs = oldestTimestamp + 60000 - Date.now();
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 100) };
  }

  return { allowed: true };
}

export function acquireRateLimit(orgId: string): () => void {
  const limits = getOrgLimits(orgId);
  limits.timestamps.push(Date.now());
  limits.concurrent++;

  // Return release function
  return () => {
    limits.concurrent = Math.max(0, limits.concurrent - 1);
  };
}

export async function withRateLimit<T>(
  orgId: string,
  fn: () => Promise<T>
): Promise<T> {
  const check = checkRateLimit(orgId);
  if (!check.allowed) {
    throw new Error(
      `Rate limit exceeded. Please try again in ${Math.ceil((check.retryAfterMs || 1000) / 1000)} seconds.`
    );
  }

  const release = acquireRateLimit(orgId);
  try {
    return await fn();
  } finally {
    release();
  }
}
