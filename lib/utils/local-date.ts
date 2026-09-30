const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const RELATIVE_DAY_LIMIT = 7;

/**
 * Parses a Postgres DATE ('YYYY-MM-DD') as local midnight of that day, since
 * new Date('YYYY-MM-DD') is UTC midnight and lands on the previous day west
 * of UTC. Any other string goes through the Date constructor.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = DATE_ONLY.exec(value);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // Reject values like 2025-02-30 that the constructor rolls over.
    return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/** Day-based wording shared by the Activity page and the dashboard feed. */
export function relativeDayLabel(date: Date, today: Date): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rounded because a daylight saving change makes a day 23 or 25 hours long.
  const diffDays = Math.round((todayStart.getTime() - day.getTime()) / MS_PER_DAY);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= RELATIVE_DAY_LIMIT) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays >= -RELATIVE_DAY_LIMIT) return `In ${-diffDays} days`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Short month and day for the pre-mount render. A 'YYYY-MM-DD' value is read
 * from its own y/m/d; any other value (e.g. a created_at timestamp) is
 * formatted in UTC so the server and the browser print the same day.
 */
export function absoluteDayLabel(value: string): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (DATE_ONLY.test(value)) {
    return (parseLocalDate(value) ?? new Date(NaN)).toLocaleDateString("en-US", options);
  }
  return new Date(value).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
