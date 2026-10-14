// Next-step scheduling for sequence enrollments. Pure: no I/O. All calendar
// math is in UTC so the result does not depend on the server's timezone.

export type ScheduleOptions = {
  // Count only Monday to Friday, and never land on a weekend.
  businessDaysOnly?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

const rollToWeekday = (d: Date): Date => {
  const out = new Date(d.getTime());
  while (isWeekend(out)) out.setTime(out.getTime() + DAY_MS);
  return out;
};

// When a step with `delayDays` should go out, counted from `from` (the
// enrollment time for the first step, the previous send for later ones).
// Negative or non-numeric delays count as 0; fractional days are allowed when
// not counting business days (0.5 = 12 hours).
export const addDelay = (
  from: Date,
  delayDays: number | null | undefined,
  options: ScheduleOptions = {},
): Date => {
  const delay = Number.isFinite(delayDays) && (delayDays as number) > 0 ? (delayDays as number) : 0;
  if (!options.businessDaysOnly) return new Date(from.getTime() + delay * DAY_MS);

  let out = rollToWeekday(from);
  let remaining = Math.ceil(delay);
  while (remaining > 0) {
    out = new Date(out.getTime() + DAY_MS);
    if (!isWeekend(out)) remaining -= 1;
  }
  return out;
};

export const isDue = (nextSendAt: Date | string | null | undefined, now: Date): boolean => {
  if (!nextSendAt) return false;
  const t = new Date(nextSendAt).getTime();
  return Number.isFinite(t) && t <= now.getTime();
};

// Pushes a failed send back so the next cron run retries it.
export const retryAt = (now: Date, attempt = 1): Date =>
  new Date(now.getTime() + Math.min(24, 2 ** Math.max(0, attempt - 1)) * 60 * 60 * 1000);
