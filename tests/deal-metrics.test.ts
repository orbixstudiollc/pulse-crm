// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysToClose, parseDealDate, stageDays } from "@/lib/deals/metrics";

const NOW = new Date(2026, 9, 1, 9, 0); // 1 Oct 2026 09:00 (local)

describe("stageDays", () => {
  it("uses the days_in_stage column when it is within the deal's age", () => {
    expect(stageDays(4, "2026-09-01T10:00:00", NOW)).toBe(4);
  });

  it("returns 0 right after a stage change resets the column", () => {
    expect(stageDays(0, "2026-09-01T10:00:00", NOW)).toBe(0);
  });

  it("falls back to days since createdAt when the column is missing", () => {
    expect(stageDays(null, "2026-09-30T15:00:00", NOW)).toBe(1);
    expect(stageDays(undefined, "2026-09-26T15:00:00", NOW)).toBe(5);
  });

  it("never exceeds the days since createdAt", () => {
    expect(stageDays(40, "2026-09-30T15:00:00", NOW)).toBe(1);
  });

  it("never returns below 0", () => {
    expect(stageDays(-3, "2026-09-01T10:00:00", NOW)).toBe(0);
    expect(stageDays(null, "2026-10-05T08:00:00", NOW)).toBe(0);
  });

  it("uses the column alone when createdAt is missing or invalid", () => {
    expect(stageDays(7, null, NOW)).toBe(7);
    expect(stageDays(7, "not-a-date", NOW)).toBe(7);
    expect(stageDays(null, null, NOW)).toBe(0);
    expect(stageDays(-2, undefined, NOW)).toBe(0);
  });
});

describe("daysToClose", () => {
  it("counts whole days until a date-only expected close", () => {
    expect(daysToClose("2026-10-06", NOW)).toBe(5);
  });

  it("returns 0 when the expected close is today", () => {
    expect(daysToClose("2026-10-01", NOW)).toBe(0);
  });

  it("is negative when overdue", () => {
    expect(daysToClose("2026-09-28", NOW)).toBe(-3);
  });

  it("returns null when missing or invalid", () => {
    expect(daysToClose(null, NOW)).toBeNull();
    expect(daysToClose(undefined, NOW)).toBeNull();
    expect(daysToClose("", NOW)).toBeNull();
    expect(daysToClose("not-a-date", NOW)).toBeNull();
  });

  it("accepts a full timestamp", () => {
    expect(daysToClose("2026-10-03T18:00:00", NOW)).toBe(2);
  });
});

describe("date-only values west of UTC", () => {
  let previousTz: string | undefined;

  beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it("parses a date-only string as a local date", () => {
    const d = parseDealDate("2026-10-06");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 6]);
  });

  it("counts days to a date-only close in local time", () => {
    expect(daysToClose("2026-10-06", new Date(2026, 9, 1, 22, 0))).toBe(5);
  });
});
