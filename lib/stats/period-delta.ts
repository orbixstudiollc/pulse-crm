// Month-over-month helpers for dashboard stat cards. Plain module: safe on client and server.

export type PeriodDelta = { text: string; trend: "up" | "down" | "flat" };

export function monthOverMonth(current: number, previous: number): PeriodDelta | null {
  if (previous === 0) {
    if (current === 0) return null;
    return { text: "New this month", trend: "up" };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  if (pct === 0) return { text: "0%", trend: "flat" };
  return pct > 0
    ? { text: `+${pct.toFixed(1)}%`, trend: "up" }
    : { text: `${pct.toFixed(1)}%`, trend: "down" };
}

export function countInMonth(
  dates: (string | null | undefined)[],
  monthOffset: 0 | -1,
  now = new Date(),
): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 1);
  let count = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (t >= start && t < end) count += 1;
  }
  return count;
}
