// Company-size buckets. Prospeo's company_headcount_range filter uses exactly
// these labels; the ICP object stores them as SIZE_* select values (see
// src/objects/icp-profile.object.ts, which derives its options the same way).

export const HEADCOUNT_LABELS = [
  '1-10', '11-20', '21-50', '51-100', '101-200', '201-500',
  '501-1000', '1001-2000', '2001-5000', '5001-10000', '10000+',
] as const;

export type HeadcountLabel = (typeof HEADCOUNT_LABELS)[number];

export function headcountValue(label: string): string {
  return `SIZE_${label.replace(/\D+/g, '_').replace(/_$/, '_PLUS')}`;
}

/** "SIZE_51_100" -> "51-100"; also accepts a label as-is. Unknown -> null. */
export function headcountLabel(value: string | null | undefined): HeadcountLabel | null {
  if (!value) return null;
  const v = value.trim();
  const byLabel = HEADCOUNT_LABELS.find((l) => l === v.replace(/\s+/g, '').replace(/,/g, ''));
  if (byLabel) return byLabel;
  return HEADCOUNT_LABELS.find((l) => headcountValue(l) === v.toUpperCase()) ?? null;
}

/** Index of a bucket (0..10), from a label, SIZE_* value, range string or employee count. */
export function headcountIndex(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return countToIndex(value);
  const label = headcountLabel(value);
  if (label) return HEADCOUNT_LABELS.indexOf(label);
  // Other range shapes such as "11-50" or "1,001-5,000": bucket by the lower bound.
  const digits = value.replace(/,/g, '').match(/\d+/);
  return digits ? countToIndex(Number(digits[0])) : null;
}

function countToIndex(count: number): number | null {
  if (!Number.isFinite(count) || count < 1) return null;
  const idx = HEADCOUNT_LABELS.findIndex((label) => {
    if (label.endsWith('+')) return true;
    const max = Number(label.split('-')[1]);
    return count <= max;
  });
  return idx;
}
