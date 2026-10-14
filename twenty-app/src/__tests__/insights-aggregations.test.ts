import { describe, expect, it } from 'vitest';

import {
  capBuckets,
  dominantCurrency,
  formatMoney,
  formatPercent,
  leadsByGrade,
  leadsBySource,
  leadsByStatus,
  newLeadsThisWeek,
  openPipeline,
  pipelineByStage,
  startOfWeek,
  weeklyNewLeads,
  winRate,
  type LeadRecord,
  type OpportunityRecord,
} from 'src/insights/aggregations';

// Thursday 1 Oct 2026, 12:00 UTC. The week starts Monday 28 Sep.
const NOW = new Date('2026-10-01T12:00:00Z');

const people: LeadRecord[] = [
  { createdAt: '2026-09-30T09:00:00Z', leadStatus: 'HOT', icpGrade: 'A', leadSource: 'WEBSITE' },
  { createdAt: '2026-09-29T00:00:00Z', leadStatus: 'NEW', icpGrade: 'B', leadSource: 'WEBSITE' },
  { createdAt: '2026-09-24T10:00:00Z', leadStatus: 'WARM', icpGrade: null, leadSource: 'LINKEDIN' },
  { createdAt: '2026-09-10T10:00:00Z', leadStatus: 'MYSTERY', icpGrade: 'A', leadSource: null },
  { createdAt: '2026-09-30T10:00:00Z', leadStatus: null, icpGrade: 'A', leadSource: 'WEBSITE' }, // not a lead
];

const usd = (n: number) => ({ amountMicros: n * 1_000_000, currencyCode: 'USD' });
const opps: OpportunityRecord[] = [
  { stage: 'NEW', amount: usd(1000) },
  { stage: 'PROPOSAL', amount: usd(5000), closeDate: '2026-12-01' },
  { stage: 'PROPOSAL', amount: { amountMicros: '2500000000', currencyCode: 'USD' }, closeDate: '2026-09-01' },
  { stage: 'CUSTOMER', amount: usd(8000) },
  { stage: 'CUSTOMER', amount: { amountMicros: 1_000_000, currencyCode: 'EUR' } },
  { stage: null, amount: null },
];

describe('lead breakdowns', () => {
  it('counts leads by status in option order, unknowns after, ignoring non-leads', () => {
    const rows = leadsByStatus(people);
    expect(rows.slice(0, 3).map((b) => [b.key, b.count])).toEqual([
      ['NEW', 1],
      ['HOT', 1],
      ['WARM', 1],
    ]);
    expect(rows[rows.length - 1]).toMatchObject({ key: 'MYSTERY', label: 'Mystery', count: 1 });
    expect(rows.reduce((s, b) => s + b.count, 0)).toBe(4);
  });

  it('puts leads without a grade in a trailing "Not set" bucket', () => {
    const rows = leadsByGrade(people);
    expect(rows.map((b) => b.key)).toEqual(['A', 'B', 'C', 'D', '__UNSET__']);
    expect(rows.find((b) => b.key === 'A')?.count).toBe(2);
    expect(rows[rows.length - 1]).toMatchObject({ label: 'Not set', count: 1 });
  });

  it('sorts sources by volume and drops empty ones', () => {
    expect(leadsBySource(people).map((b) => [b.key, b.count])).toEqual([
      ['WEBSITE', 2],
      ['LINKEDIN', 1],
      ['__UNSET__', 1],
    ]);
  });

  it('folds long tails into "Other"', () => {
    const rows = capBuckets(
      ['a', 'b', 'c', 'd'].map((key) => ({ key, label: key, count: 1, value: 2 })),
      3,
    );
    expect(rows.map((b) => b.label)).toEqual(['a', 'b', 'Other (2)']);
    expect(rows[2]).toMatchObject({ count: 2, value: 4 });
  });
});

describe('time windows', () => {
  it('starts weeks on Monday UTC', () => {
    expect(startOfWeek(NOW).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(startOfWeek(new Date('2026-10-04T23:00:00Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(startOfWeek(new Date('2026-09-28T00:00:00Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('counts new leads this week against last week', () => {
    expect(newLeadsThisWeek(people, NOW)).toEqual({ thisWeek: 2, lastWeek: 1, delta: 1 });
  });

  it('buckets new leads per week, oldest first', () => {
    const weeks = weeklyNewLeads(people, NOW, 4);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    expect(weeks.map((w) => w.count)).toEqual([1, 0, 1, 2]);
  });
});

describe('pipeline', () => {
  it('sums value and count per stage in pipeline order', () => {
    const rows = pipelineByStage(opps);
    expect(rows.map((b) => [b.key, b.count, b.value])).toEqual([
      ['NEW', 1, 1000],
      ['SCREENING', 0, 0],
      ['MEETING', 0, 0],
      ['PROPOSAL', 2, 7500],
      ['CUSTOMER', 2, 8001],
      ['__UNSET__', 1, 0],
    ]);
  });

  it('computes open pipeline excluding won deals', () => {
    expect(openPipeline(opps)).toEqual({ count: 4, value: 8500 });
  });

  it('treats overdue open deals as lost for the win rate', () => {
    expect(winRate(opps, NOW)).toEqual({ won: 2, lost: 1, rate: 2 / 3 });
    expect(winRate([{ stage: 'LOST' }, { stage: 'CUSTOMER' }], NOW).rate).toBe(0.5);
    expect(winRate([{ stage: 'NEW' }], NOW).rate).toBeNull();
  });

  it('labels money with the most common currency', () => {
    expect(dominantCurrency(opps)).toBe('USD');
    expect(dominantCurrency([])).toBe('USD');
    expect(formatMoney(8500, 'USD')).toBe('$8.5k');
    expect(formatMoney(2_000_000, 'EUR')).toBe('€2M');
    expect(formatMoney(950, 'CHF')).toBe('950 CHF');
    expect(formatPercent(2 / 3)).toBe('67%');
    expect(formatPercent(null)).toBe('–');
  });
});
