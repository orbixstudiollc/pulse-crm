import { describe, expect, it } from 'vitest'
import { TASK_CAPS, computeNextRun, isDue, orderForFairness } from '@/lib/ai/tasks/schedule'

const NOW = new Date('2026-03-10T12:00:00.000Z')
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString()

const dueTask = {
  is_active: true,
  next_run_at: '2026-03-10T00:00:00.000Z',
  last_run_at: null as string | null,
  locked_at: null as string | null,
}

describe('computeNextRun', () => {
  it('daily returns the next 00:00 UTC after from', () => {
    expect(computeNextRun('daily', new Date('2026-03-10T15:30:00Z'))?.toISOString()).toBe(
      '2026-03-11T00:00:00.000Z',
    )
    expect(computeNextRun('daily', new Date('2026-03-10T00:00:00Z'))?.toISOString()).toBe(
      '2026-03-11T00:00:00.000Z',
    )
  })

  it('weekly is +7 days at 00:00 UTC', () => {
    expect(computeNextRun('weekly', new Date('2026-03-10T15:30:00Z'))?.toISOString()).toBe(
      '2026-03-17T00:00:00.000Z',
    )
  })

  it('monthly from Jan 31 clamps to Feb 28 (non-leap) and Feb 29 (leap)', () => {
    expect(computeNextRun('monthly', new Date('2026-01-31T09:00:00Z'))?.toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(computeNextRun('monthly', new Date('2028-01-31T09:00:00Z'))?.toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    )
  })

  it('monthly keeps the same day and rolls the year in December', () => {
    expect(computeNextRun('monthly', new Date('2026-12-15T09:00:00Z'))?.toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    )
  })

  it('custom cron rounds the next match forward to the next 00:00 UTC slot', () => {
    // 2026-03-10 is a Tuesday; next Monday 09:00 is 03-16, rounded to 03-17 00:00
    expect(computeNextRun('custom', NOW, '0 9 * * 1')?.toISOString()).toBe('2026-03-17T00:00:00.000Z')
    // an exact-midnight match stays: 1st of the month at 00:00
    expect(computeNextRun('custom', NOW, '0 0 1 * *')?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    // later today at 15:00 rounds to tomorrow 00:00
    expect(computeNextRun('custom', NOW, '0 15 * * *')?.toISOString()).toBe('2026-03-11T00:00:00.000Z')
  })

  it('custom cron supports lists, ranges and steps', () => {
    expect(computeNextRun('custom', NOW, '*/15 0 * * 1-5')?.toISOString()).toBe(
      '2026-03-11T00:00:00.000Z',
    )
    expect(computeNextRun('custom', NOW, '0 0 15,20 * *')?.toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    )
  })

  it('returns null for an invalid custom cron instead of falling back to daily', () => {
    const invalid = [
      'not a cron',
      '* * * *',
      '* * * * * *',
      '61 * * * *',
      '* 24 * * *',
      '*/0 * * * *',
      '5-1 * * * *',
      '',
    ]
    for (const bad of invalid) {
      expect(computeNextRun('custom', NOW, bad)).toBeNull()
    }
    expect(computeNextRun('custom', NOW, null)).toBeNull()
    expect(computeNextRun('custom', NOW, undefined)).toBeNull()
  })

  it('returns null for a cron that can never match', () => {
    expect(computeNextRun('custom', NOW, '0 0 31 2 *')).toBeNull()
  })
})

describe('isDue', () => {
  it('is true for an active, due, never-run, unlocked task', () => {
    expect(isDue(dueTask, NOW)).toBe(true)
  })

  it('is false when inactive or next_run_at is null or in the future', () => {
    expect(isDue({ ...dueTask, is_active: false }, NOW)).toBe(false)
    expect(isDue({ ...dueTask, next_run_at: null }, NOW)).toBe(false)
    expect(isDue({ ...dueTask, next_run_at: '2026-03-10T12:00:01.000Z' }, NOW)).toBe(false)
  })

  it('is false when it ran 2 h ago and true when it last ran 21 h ago', () => {
    expect(isDue({ ...dueTask, last_run_at: minutesAgo(120) }, NOW)).toBe(false)
    expect(isDue({ ...dueTask, last_run_at: minutesAgo(21 * 60) }, NOW)).toBe(true)
  })

  it('is false when locked 5 minutes ago', () => {
    expect(isDue({ ...dueTask, locked_at: minutesAgo(5) }, NOW)).toBe(false)
  })

  it('is true when locked 20 minutes ago (stale lock)', () => {
    expect(isDue({ ...dueTask, locked_at: minutesAgo(20) }, NOW)).toBe(true)
  })
})

describe('orderForFairness', () => {
  it('puts never-run tasks first, then the older run before the newer run', () => {
    const today = { id: 'today', last_run_at: '2026-03-10T00:00:00Z', next_run_at: '2026-03-11T00:00:00Z' }
    const yesterday = {
      id: 'yesterday',
      last_run_at: '2026-03-09T00:00:00Z',
      next_run_at: '2026-03-10T00:00:00Z',
    }
    const never = { id: 'never', last_run_at: null, next_run_at: '2026-03-10T00:00:00Z' }
    expect(orderForFairness([today, yesterday, never]).map((t) => t.id)).toEqual([
      'never',
      'yesterday',
      'today',
    ])
  })

  it('breaks ties by next_run_at ascending and does not mutate the input', () => {
    const a = { id: 'a', last_run_at: null, next_run_at: '2026-03-12T00:00:00Z' }
    const b = { id: 'b', last_run_at: null, next_run_at: '2026-03-10T00:00:00Z' }
    const input = [a, b]
    expect(orderForFairness(input).map((t) => t.id)).toEqual(['b', 'a'])
    expect(input.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('TASK_CAPS', () => {
  it('exposes the agreed limits', () => {
    expect(TASK_CAPS).toEqual({
      perOrg: 3,
      guestPerOrg: 1,
      perOrgRunsPerInvocation: 1,
      stepsPerRun: 4,
      maxOutputTokens: 1536,
      perTaskTimeoutMs: 30000,
    })
  })
})
