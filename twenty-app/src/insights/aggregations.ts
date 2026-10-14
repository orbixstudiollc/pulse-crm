// Pure aggregations behind the Overview and Analytics widgets. No I/O here:
// the front components fetch records and hand them to these functions.

import { LEAD_SOURCES, LEAD_STATUSES } from 'src/gtm/lead-values';

export type LeadRecord = {
  createdAt?: string | null;
  leadStatus?: string | null;
  leadScore?: number | null;
  icpGrade?: string | null;
  leadSource?: string | null;
};

export type OpportunityRecord = {
  createdAt?: string | null;
  stage?: string | null;
  closeDate?: string | null;
  amount?: { amountMicros?: number | string | null; currencyCode?: string | null } | null;
};

export type Bucket = { key: string; label: string; count: number; value: number; color?: string };

// Twenty's default opportunity stages. Workspaces can add more; unknown
// stages are appended after these in first-seen order.
export const OPPORTUNITY_STAGES = [
  { value: 'NEW', label: 'New' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'CUSTOMER', label: 'Won' },
] as const;

export const WON_STAGES = new Set(['CUSTOMER', 'WON', 'CLOSED_WON']);
export const LOST_STAGES = new Set(['LOST', 'CLOSED_LOST']);

export const ICP_GRADES = [
  { value: 'A', label: 'A', color: 'green' },
  { value: 'B', label: 'B', color: 'blue' },
  { value: 'C', label: 'C', color: 'yellow' },
  { value: 'D', label: 'D', color: 'red' },
] as const;

type Option = { value: string; label: string; color?: string };

export const UNSET_KEY = '__UNSET__';

export const amountOf = (opp: OpportunityRecord): number => {
  const micros = Number(opp.amount?.amountMicros ?? 0);
  return Number.isFinite(micros) ? micros / 1_000_000 : 0;
};

const isLead = (p: LeadRecord) => p.leadStatus != null && p.leadStatus !== '';

/** Count records by a select value, in option order, with unknown values and blanks last. */
export const countBy = <T>(
  records: T[],
  pick: (r: T) => string | null | undefined,
  options: readonly Option[],
  { includeUnset = true, weight }: { includeUnset?: boolean; weight?: (r: T) => number } = {},
): Bucket[] => {
  const buckets = new Map<string, Bucket>();
  for (const o of options) {
    buckets.set(o.value, { key: o.value, label: o.label, count: 0, value: 0, color: o.color });
  }
  for (const r of records) {
    const raw = pick(r);
    const key = raw == null || raw === '' ? UNSET_KEY : raw;
    if (key === UNSET_KEY && !includeUnset) continue;
    let b = buckets.get(key);
    if (!b) {
      b = { key, label: key === UNSET_KEY ? 'Not set' : humanize(key), count: 0, value: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    b.value += weight ? weight(r) : 0;
  }
  const all = [...buckets.values()];
  const unset = all.filter((b) => b.key === UNSET_KEY);
  return [...all.filter((b) => b.key !== UNSET_KEY), ...unset];
};

export const humanize = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

export const leadsByStatus = (people: LeadRecord[]): Bucket[] =>
  countBy(people.filter(isLead), (p) => p.leadStatus, LEAD_STATUSES);

export const leadsByGrade = (people: LeadRecord[]): Bucket[] =>
  countBy(people.filter(isLead), (p) => p.icpGrade, ICP_GRADES);

/** Sources sorted by volume, empty sources dropped, so the busiest channels come first. */
export const leadsBySource = (people: LeadRecord[]): Bucket[] =>
  countBy(people.filter(isLead), (p) => p.leadSource, LEAD_SOURCES)
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

/** Deal count and summed amount per stage, in pipeline order. */
export const pipelineByStage = (opps: OpportunityRecord[]): Bucket[] =>
  countBy(opps, (o) => o.stage, OPPORTUNITY_STAGES, { weight: amountOf });

/** Monday 00:00 UTC of the week containing `now`. */
export const startOfWeek = (now: Date): Date => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const inRange = (iso: string | null | undefined, from: number, to: number) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= from && t < to;
};

/** Leads created since Monday, and in the whole of last week, for a delta. */
export const newLeadsThisWeek = (people: LeadRecord[], now: Date) => {
  const start = startOfWeek(now).getTime();
  const leads = people.filter(isLead);
  const thisWeek = leads.filter((p) => inRange(p.createdAt, start, now.getTime() + 1)).length;
  const lastWeek = leads.filter((p) => inRange(p.createdAt, start - WEEK_MS, start)).length;
  return { thisWeek, lastWeek, delta: thisWeek - lastWeek };
};

/** New leads per week for the last `weeks` weeks, oldest first. */
export const weeklyNewLeads = (people: LeadRecord[], now: Date, weeks = 8) => {
  const current = startOfWeek(now).getTime();
  const leads = people.filter(isLead);
  return Array.from({ length: weeks }, (_, i) => {
    const from = current - (weeks - 1 - i) * WEEK_MS;
    const to = from + WEEK_MS;
    return {
      weekStart: new Date(from).toISOString().slice(0, 10),
      count: leads.filter((p) => inRange(p.createdAt, from, to)).length,
    };
  });
};

/**
 * Win rate over closed deals. Twenty's default pipeline has no lost stage, so
 * a deal counts as lost when it sits in a lost stage, or when its close date
 * has passed without being won. Returns null when nothing has closed yet.
 */
export const winRate = (opps: OpportunityRecord[], now: Date) => {
  let won = 0;
  let lost = 0;
  for (const o of opps) {
    const stage = o.stage ?? '';
    if (WON_STAGES.has(stage)) won += 1;
    else if (LOST_STAGES.has(stage)) lost += 1;
    else if (o.closeDate && Date.parse(o.closeDate) < now.getTime()) lost += 1;
  }
  const closed = won + lost;
  return { won, lost, rate: closed === 0 ? null : won / closed };
};

/** Value and count of deals that are neither won nor lost. */
export const openPipeline = (opps: OpportunityRecord[]) => {
  const open = opps.filter((o) => !WON_STAGES.has(o.stage ?? '') && !LOST_STAGES.has(o.stage ?? ''));
  return { count: open.length, value: open.reduce((sum, o) => sum + amountOf(o), 0) };
};

/** The most common currency, used to label summed amounts. */
export const dominantCurrency = (opps: OpportunityRecord[], fallback = 'USD'): string => {
  const counts = new Map<string, number>();
  for (const o of opps) {
    const c = o.amount?.currencyCode;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = fallback;
  let max = 0;
  for (const [c, n] of counts) {
    if (n > max) {
      best = c;
      max = n;
    }
  }
  return best;
};

/** Keep the first `max - 1` buckets and fold the rest into "Other". */
export const capBuckets = (buckets: Bucket[], max: number): Bucket[] => {
  if (buckets.length <= max) return buckets;
  const head = buckets.slice(0, max - 1);
  const rest = buckets.slice(max - 1);
  return [
    ...head,
    {
      key: '__REST__',
      label: `Other (${rest.length})`,
      count: rest.reduce((s, b) => s + b.count, 0),
      value: rest.reduce((s, b) => s + b.value, 0),
      color: 'gray',
    },
  ];
};

export const hotLeadCount = (people: LeadRecord[]): number =>
  people.filter((p) => p.leadStatus === 'HOT').length;

/** Compact money for tiles: 950, 12.5k, 3.2M. */
export const formatMoney = (value: number, currency: string): string => {
  const abs = Math.abs(value);
  const fmt = (n: number, suffix: string) =>
    `${n.toFixed(n >= 100 || Number.isInteger(n) ? 0 : 1)}${suffix}`;
  const body =
    abs >= 1_000_000 ? fmt(value / 1_000_000, 'M') : abs >= 1_000 ? fmt(value / 1_000, 'k') : fmt(value, '');
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  return symbol ? `${symbol}${body}` : `${body} ${currency}`;
};

export const formatPercent = (rate: number | null): string =>
  rate == null ? '–' : `${Math.round(rate * 100)}%`;
