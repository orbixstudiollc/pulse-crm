const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date-only 'YYYY-MM-DD' (Postgres DATE) is a local date; anything else uses the Date parser. */
function parseDate(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole calendar months from customerSince (fallback createdAt) to now; 0 if unknown. */
export function customerTenureMonths(
  customerSince: string | null | undefined,
  createdAt: string | null | undefined,
  now: Date = new Date(),
): number {
  const source = customerSince || createdAt;
  if (!source) return 0;
  const start = parseDate(source);
  if (Number.isNaN(start.getTime())) return 0;
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/** Stored lifetime value when it is a positive number, else the closed-won total. */
export function customerLifetimeValue(
  stored: number | null | undefined,
  closedWonTotal = 0,
): number {
  return typeof stored === "number" && stored > 0 ? stored : closedWonTotal;
}
