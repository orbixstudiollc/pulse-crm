// Lead qualification: statuses, gates and the field names the workspace uses.

// Bump when the prompts or the gate rules change, so re-qualified people can
// be told apart from earlier runs.
export const QUALIFICATION_VERSION = 'q1-2026-10-08';

// A company or title is Qualified at or above the threshold, Rejected below
// REJECT_BELOW and Review in between.
export const DEFAULT_THRESHOLD = 0.85;
export const REJECT_BELOW = 0.5;

export const QUALIFICATION_STATUSES = [
  { label: 'Pending', value: 'PENDING', color: 'gray' },
  { label: 'Qualified', value: 'QUALIFIED', color: 'green' },
  { label: 'Review', value: 'REVIEW', color: 'yellow' },
  { label: 'Rejected', value: 'REJECTED', color: 'red' },
  { label: 'Enrolled', value: 'ENROLLED', color: 'blue' },
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number]['value'];

// Values of the workspace's Agency classification / Title classification selects.
export type Classification = 'QUALIFIED' | 'REVIEW' | 'REJECTED';

// Values of the workspace's Email verification status select.
export type EmailStatus = 'VERIFIED' | 'UNVERIFIED' | 'INVALID' | 'UNKNOWN' | 'SUPPRESSED';
export const EMAIL_STATUSES: readonly EmailStatus[] = ['VERIFIED', 'UNVERIFIED', 'INVALID', 'UNKNOWN', 'SUPPRESSED'];

export const classify = (confidence: number | null | undefined, threshold: number): Classification | null => {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) return null;
  if (confidence >= threshold) return 'QUALIFIED';
  if (confidence < REJECT_BELOW) return 'REJECTED';
  return 'REVIEW';
};

export const clampConfidence = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace('%', '')) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n)) return null;
  // Accept 0-1 or 0-100.
  const v = n > 1 ? n / 100 : n;
  return Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
};

export const readThreshold = (raw: string | undefined): number => {
  const v = clampConfidence(raw?.trim() || undefined);
  return v && v >= 0.5 ? v : DEFAULT_THRESHOLD;
};
