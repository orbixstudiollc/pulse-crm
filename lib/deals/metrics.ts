const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Date-only 'YYYY-MM-DD' (Postgres DATE) is a local date; anything else uses the Date parser. */
export function parseDealDate(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseValid(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = parseDealDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole local calendar days from `from` to `to` (negative when `to` is earlier). */
function calendarDaysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Whole local calendar days in the current stage: days since stageChangedAt
 * (createdAt when it is missing, and never earlier than createdAt), never
 * below 0. 0 when neither timestamp is usable.
 */
export function stageDays(
  stageChangedAt: string | null | undefined,
  createdAt: string | null | undefined,
  now: Date = new Date(),
): number {
  const changed = parseValid(stageChangedAt);
  const created = parseValid(createdAt);
  const since = changed && created ? (changed > created ? changed : created) : (changed ?? created);
  return since ? Math.max(0, calendarDaysBetween(since, now)) : 0;
}

/** Whole days until the expected close date; negative when overdue, null when unknown. */
export function daysToClose(
  expectedClose: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const close = parseValid(expectedClose);
  return close ? calendarDaysBetween(now, close) : null;
}
