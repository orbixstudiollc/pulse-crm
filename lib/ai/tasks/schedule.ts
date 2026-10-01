/**
 * Pure scheduling helpers and caps for AI tasks. No I/O, no clock reads:
 * callers pass `now` / `from` so everything here is deterministic.
 */

export type TaskSchedule = 'daily' | 'weekly' | 'monthly' | 'custom'

export const TASK_CAPS = {
  perOrg: 3,
  guestPerOrg: 1,
  perOrgRunsPerInvocation: 1,
  stepsPerRun: 4,
  maxOutputTokens: 1536,
  perTaskTimeoutMs: 30000,
} as const

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_RERUN_MS = 20 * 60 * 60 * 1000
const LOCK_STALE_MS = 15 * 60 * 1000
const CRON_SEARCH_DAYS = 366 * 5

interface CronField {
  values: Set<number>
  wildcard: boolean
}

interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

function parseField(
  text: string,
  min: number,
  max: number,
  mapValue: (n: number) => number = (n) => n,
): CronField | null {
  const values = new Set<number>()
  let wildcard = false
  for (const part of text.split(',')) {
    const [rangePart, stepPart, ...extra] = part.split('/')
    if (extra.length > 0 || rangePart === '') return null
    let step = 1
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart)) return null
      step = Number(stepPart)
      if (step < 1) return null
    }
    let lo: number
    let hi: number
    if (rangePart === '*') {
      lo = min
      hi = max
      if (stepPart === undefined) wildcard = true
    } else {
      const m = /^(\d+)(?:-(\d+))?$/.exec(rangePart)
      if (!m) return null
      lo = Number(m[1])
      hi = m[2] === undefined ? (stepPart === undefined ? lo : max) : Number(m[2])
      if (lo > hi || lo < min || hi > max) return null
    }
    for (let n = lo; n <= hi; n += step) values.add(mapValue(n))
  }
  return values.size > 0 ? { values, wildcard } : null
}

function parseCron(expression: string): ParsedCron | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const minute = parseField(parts[0], 0, 59)
  const hour = parseField(parts[1], 0, 23)
  const dayOfMonth = parseField(parts[2], 1, 31)
  const month = parseField(parts[3], 1, 12)
  const dayOfWeek = parseField(parts[4], 0, 7, (n) => n % 7)
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null
  return { minute, hour, dayOfMonth, month, dayOfWeek }
}

function dayMatches(cron: ParsedCron, day: Date): boolean {
  if (!cron.month.values.has(day.getUTCMonth() + 1)) return false
  const domOk = cron.dayOfMonth.values.has(day.getUTCDate())
  const dowOk = cron.dayOfWeek.values.has(day.getUTCDay())
  // Standard cron: when both day fields are restricted, either may match.
  if (!cron.dayOfMonth.wildcard && !cron.dayOfWeek.wildcard) return domOk || dowOk
  return domOk && dowOk
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** First cron-matching minute strictly after `from`, or null if none within the search window. */
function nextCronMatch(cron: ParsedCron, from: Date): Date | null {
  const dayStart = startOfUtcDay(from)
  for (let i = 0; i <= CRON_SEARCH_DAYS; i++) {
    const dayMs = dayStart + i * DAY_MS
    if (!dayMatches(cron, new Date(dayMs))) continue
    for (let h = 0; h < 24; h++) {
      if (!cron.hour.values.has(h)) continue
      for (let m = 0; m < 60; m++) {
        if (!cron.minute.values.has(m)) continue
        const candidate = dayMs + h * 3600000 + m * 60000
        if (candidate > from.getTime()) return new Date(candidate)
      }
    }
  }
  return null
}

/**
 * Next run time for a schedule, always at 00:00 UTC (the cron endpoint runs once a day).
 * Returns null for an invalid (or never-matching) custom cron: the caller must skip the
 * task and record `invalid_schedule` rather than silently falling back to daily.
 */
export function computeNextRun(
  schedule: TaskSchedule,
  from: Date,
  cronExpression?: string | null,
): Date | null {
  const today = startOfUtcDay(from)
  switch (schedule) {
    case 'daily':
      return new Date(today + DAY_MS)
    case 'weekly':
      return new Date(today + 7 * DAY_MS)
    case 'monthly': {
      const year = from.getUTCFullYear()
      const nextMonth = from.getUTCMonth() + 1
      const daysInNextMonth = new Date(Date.UTC(year, nextMonth + 1, 0)).getUTCDate()
      const day = Math.min(from.getUTCDate(), daysInNextMonth)
      return new Date(Date.UTC(year, nextMonth, day))
    }
    case 'custom': {
      if (typeof cronExpression !== 'string') return null
      const cron = parseCron(cronExpression)
      if (!cron) return null
      const match = nextCronMatch(cron, from)
      if (!match) return null
      const matchDay = startOfUtcDay(match)
      // Round forward to the next 00:00 UTC slot (an exact midnight match stays).
      return new Date(match.getTime() === matchDay ? matchDay : matchDay + DAY_MS)
    }
    default:
      return null
  }
}

export interface DueCheckTask {
  is_active: boolean
  next_run_at: string | null
  last_run_at: string | null
  locked_at: string | null
}

export function isDue(task: DueCheckTask, now: Date): boolean {
  if (!task.is_active || !task.next_run_at) return false
  const nowMs = now.getTime()
  const nextRun = Date.parse(task.next_run_at)
  if (Number.isNaN(nextRun) || nextRun > nowMs) return false
  if (task.last_run_at) {
    const lastRun = Date.parse(task.last_run_at)
    if (!Number.isNaN(lastRun) && nowMs - lastRun < MIN_RERUN_MS) return false
  }
  if (task.locked_at) {
    const locked = Date.parse(task.locked_at)
    if (!Number.isNaN(locked) && nowMs - locked <= LOCK_STALE_MS) return false
  }
  return true
}

function timeOrNegInfinity(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const t = Date.parse(value)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

function compareNumbers(a: number, b: number): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Least-recently-served first: last_run_at ascending (NULLs first), then next_run_at ascending. */
export function orderForFairness<T extends { last_run_at: string | null; next_run_at: string | null }>(
  tasks: T[],
): T[] {
  return [...tasks].sort(
    (a, b) =>
      compareNumbers(timeOrNegInfinity(a.last_run_at), timeOrNegInfinity(b.last_run_at)) ||
      compareNumbers(timeOrNegInfinity(a.next_run_at), timeOrNegInfinity(b.next_run_at)),
  )
}
