import type { ICPWeights } from "@/lib/actions/icp";

const WEIGHT_KEYS = ["industry", "size", "revenue", "title", "geography", "tech"] as const;
const TOTAL = 100;

export const DEFAULT_ICP_WEIGHTS: ICPWeights = {
  industry: 25,
  size: 20,
  revenue: 15,
  title: 15,
  geography: 15,
  tech: 10,
};

function toWeight(value: unknown): number {
  // Numeric strings ("25") count; Number("") is 0 and Number(null) is 0, both treated as unset.
  const n = typeof value === "number" || typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Scales ICP weights to integers that total exactly 100 (largest-remainder rounding).
 * Numeric strings are accepted; missing, negative and non-finite values count as 0; an all-zero input returns the default.
 */
export function normalizeWeights(raw: Partial<ICPWeights> | null | undefined): ICPWeights {
  const values = WEIGHT_KEYS.map((key) => toWeight(raw?.[key]));
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return { ...DEFAULT_ICP_WEIGHTS };

  const scaled = values.map((v) => (v / sum) * TOTAL);
  const floored = scaled.map(Math.floor);
  let leftover = TOTAL - floored.reduce((s, v) => s + v, 0);

  // Hand the leftover points to the largest fractional parts; ties go to the earlier key.
  const order = scaled
    .map((v, i) => ({ i, frac: v - floored[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = [...floored];
  for (const { i } of order) {
    if (leftover <= 0) break;
    result[i] += 1;
    leftover -= 1;
  }

  return Object.fromEntries(WEIGHT_KEYS.map((key, i) => [key, result[i]])) as ICPWeights;
}
