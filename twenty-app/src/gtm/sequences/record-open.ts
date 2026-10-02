// Counts an email open from the tracking pixel. The route is public, so it
// only counts ids that exist, and each enrollment + variant once.

import type { SequenceStore } from 'src/gtm/sequences/store';

export type OnceStore = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
};

const ID = /^[0-9a-f-]{36}$/i;

export const recordOpen = async ({
  store,
  seen,
  enrollmentId,
  variantId,
}: {
  store: SequenceStore;
  seen: OnceStore;
  enrollmentId?: string | null;
  variantId?: string | null;
}): Promise<'counted' | 'duplicate' | 'ignored'> => {
  if (!enrollmentId || !variantId || !ID.test(enrollmentId) || !ID.test(variantId)) return 'ignored';
  const key = `seq-open:${enrollmentId}:${variantId}`;
  if (await seen.get(key)) return 'duplicate';
  const [enrollment] = await store.getEnrollmentsByIds([enrollmentId]);
  if (!enrollment || !(await store.variantExists(variantId))) return 'ignored';
  await seen.set(key, true);
  await store.incrementVariantStats(variantId, { opened: 1 });
  return 'counted';
};
