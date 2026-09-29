export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export const TRACKING_BUCKET = { capacity: 60, refillPerSecond: 1 } as const;

export const TRACKING_MAX_BUCKETS = 10_000;
const IDLE_EVICT_MS = 10 * 60 * 1000;

export function takeToken(
  store: Map<string, Bucket>,
  key: string,
  now: number,
  cfg: { capacity: number; refillPerSecond: number } = TRACKING_BUCKET
): boolean {
  if (store.size > TRACKING_MAX_BUCKETS) {
    for (const [k, b] of store) {
      if (now - b.updatedAt > IDLE_EVICT_MS) store.delete(k);
    }
  }
  if (store.size > TRACKING_MAX_BUCKETS) {
    const oldestFirst = [...store].sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
    for (const [k] of oldestFirst) {
      if (store.size <= TRACKING_MAX_BUCKETS) break;
      store.delete(k);
    }
  }

  const prev = store.get(key);
  const elapsedSeconds = prev ? Math.max(0, now - prev.updatedAt) / 1000 : 0;
  const tokens = prev
    ? Math.min(cfg.capacity, prev.tokens + elapsedSeconds * cfg.refillPerSecond)
    : cfg.capacity;

  if (tokens < 1) {
    store.set(key, { tokens, updatedAt: now });
    return false;
  }
  store.set(key, { tokens: tokens - 1, updatedAt: now });
  return true;
}

// Instance-local and best-effort: on Fluid compute each instance keeps its own
// buckets, so the effective limit scales with the number of live instances.
export const trackingBuckets = new Map<string, Bucket>();
