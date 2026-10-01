// A/B testing for sequence steps. Pure: no I/O.
//
// Assignment is deterministic: an enrollment id hashes to a fixed point in
// [0, 1), and that point picks a variant by weight. The same enrollment
// therefore always gets the same variant for a step, and lands in the same
// "arm" position on later steps when their weights match, so follow-ups stay
// consistent.
//
// Auto-winner: once every active variant of a step has at least `minSends`
// sends, the one with the strictly best reply rate takes all new sends.

export type VariantStats = {
  id: string;
  weight?: number | null;
  isActive?: boolean | null;
  sent?: number | null;
  replied?: number | null;
  opened?: number | null;
};

export const DEFAULT_WINNER_MIN_SENDS = 50;

// FNV-1a, 32-bit. Stable across runtimes; good enough spread for bucketing.
export const hashToUnit = (key: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
};

const positiveWeight = (w: number | null | undefined) =>
  typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0;

export const activeVariants = <T extends VariantStats>(variants: readonly T[]): T[] =>
  variants.filter((v) => v.isActive !== false);

// Variants are ordered by id so assignment does not depend on query order.
export const assignVariant = <T extends VariantStats>(
  variants: readonly T[],
  enrollmentId: string,
): T | null => {
  const pool = [...activeVariants(variants)].sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  const weights = pool.map((v) => positiveWeight(v.weight));
  const total = weights.reduce((s, w) => s + w, 0);
  const effective = total > 0 ? weights : pool.map(() => 1);
  const sum = total > 0 ? total : pool.length;
  let point = hashToUnit(enrollmentId) * sum;
  for (let i = 0; i < pool.length; i += 1) {
    point -= effective[i];
    if (point < 0) return pool[i];
  }
  return pool[pool.length - 1];
};

export const rate = (part: number | null | undefined, whole: number | null | undefined): number => {
  const w = whole ?? 0;
  return w > 0 ? Math.round(((part ?? 0) / w) * 1000) / 10 : 0;
};

export const pickWinner = <T extends VariantStats>(
  variants: readonly T[],
  minSends: number | null | undefined = DEFAULT_WINNER_MIN_SENDS,
): T | null => {
  const pool = activeVariants(variants);
  if (pool.length < 2) return null;
  const min = Math.max(1, minSends ?? DEFAULT_WINNER_MIN_SENDS);
  if (pool.some((v) => (v.sent ?? 0) < min)) return null;
  const scored = pool
    .map((v) => ({ v, r: (v.replied ?? 0) / (v.sent as number) }))
    .sort((a, b) => b.r - a.r);
  return scored[0].r > scored[1].r ? scored[0].v : null;
};

// The variant a send should use: the winner when auto-winner is on and one is
// decided, else the hashed assignment.
export const chooseVariant = <T extends VariantStats>(
  variants: readonly T[],
  enrollmentId: string,
  options: { autoPickWinner?: boolean | null; winnerMinSends?: number | null } = {},
): { variant: T | null; byWinner: boolean } => {
  if (options.autoPickWinner) {
    const winner = pickWinner(variants, options.winnerMinSends);
    if (winner) return { variant: winner, byWinner: true };
  }
  return { variant: assignVariant(variants, enrollmentId), byWinner: false };
};

// Open-tracking pixel for a sent email; base is the public URL of the
// trackSequenceOpen route.
export const openPixelHtml = (base: string, enrollmentId: string, variantId: string | null) => {
  const url = new URL(base);
  url.searchParams.set('e', enrollmentId);
  if (variantId) url.searchParams.set('v', variantId);
  const src = url.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<img src="${src}" width="1" height="1" alt="" style="display:none">`;
};
