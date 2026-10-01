// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { absoluteDayLabel, parseLocalDate, relativeDayLabel } from "@/lib/utils/local-date";

// West of UTC, so a DATE parsed as UTC midnight would land on the previous day.
// Set here rather than with a TZ= prefix because Git Bash drops that prefix.
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/New_York";
});

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("parseLocalDate", () => {
  it("parses a YYYY-MM-DD string as local midnight of that day", () => {
    const date = parseLocalDate("2025-10-01");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2025);
    expect(date!.getMonth()).toBe(9);
    expect(date!.getDate()).toBe(1);
    expect(date!.getHours()).toBe(0);
  });

  it("parses any other string with the Date constructor", () => {
    const value = "2025-10-01T02:00:00Z";
    expect(parseLocalDate(value)!.getTime()).toBe(new Date(value).getTime());
  });

  it("returns null for empty, missing and invalid values", () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate("not a date")).toBeNull();
    expect(parseLocalDate("2025-02-30")).toBeNull();
  });
});

describe("relativeDayLabel", () => {
  // Built lazily so it uses the zone set in beforeAll, not the collection-time one.
  const today = () => new Date(2025, 9, 1, 9, 30);

  it("labels a DATE for today as Today in a zone west of UTC", () => {
    expect(relativeDayLabel(parseLocalDate("2025-10-01")!, today())).toBe("Today");
    expect(relativeDayLabel(parseLocalDate("2025-09-30")!, today())).toBe("Yesterday");
  });

  it("ignores the time of day on both dates", () => {
    expect(relativeDayLabel(new Date(2025, 9, 1, 23, 59), today())).toBe("Today");
    expect(relativeDayLabel(new Date(2025, 8, 30, 0, 1), new Date(2025, 9, 1, 23, 59))).toBe(
      "Yesterday",
    );
  });

  it("counts past days up to a week", () => {
    expect(relativeDayLabel(new Date(2025, 8, 29), today())).toBe("2 days ago");
    expect(relativeDayLabel(new Date(2025, 8, 24), today())).toBe("7 days ago");
  });

  it("counts future days up to a week", () => {
    expect(relativeDayLabel(new Date(2025, 9, 2), today())).toBe("Tomorrow");
    expect(relativeDayLabel(new Date(2025, 9, 5), today())).toBe("In 4 days");
    expect(relativeDayLabel(new Date(2025, 9, 8), today())).toBe("In 7 days");
  });

  it("falls back to a short month and day beyond a week", () => {
    expect(relativeDayLabel(new Date(2025, 8, 23), today())).toBe("Sep 23");
    expect(relativeDayLabel(new Date(2025, 9, 9), today())).toBe("Oct 9");
  });

  it("counts whole days across a daylight saving change", () => {
    // Clocks spring forward on 2025-03-09 in New York, so the gap is 47 hours.
    expect(relativeDayLabel(new Date(2025, 2, 8), new Date(2025, 2, 10))).toBe("2 days ago");
    // Clocks fall back on 2025-11-02, so the gap is 25 hours.
    expect(relativeDayLabel(new Date(2025, 10, 1), new Date(2025, 10, 2))).toBe("Yesterday");
  });
});

describe("absoluteDayLabel", () => {
  it("formats a YYYY-MM-DD value from its own year, month and day", () => {
    expect(absoluteDayLabel("2025-10-01")).toBe("Oct 1");
    expect(absoluteDayLabel("2025-12-31")).toBe("Dec 31");
  });

  it("formats a timestamp in UTC so it does not depend on the renderer's zone", () => {
    // 02:00 UTC is still Sep 30 in New York, but the label must match the UTC server render.
    expect(absoluteDayLabel("2025-10-01T02:00:00Z")).toBe("Oct 1");
    expect(absoluteDayLabel("2025-10-01T23:30:00Z")).toBe("Oct 1");
  });

  it("accepts other date options, still in UTC for timestamps", () => {
    const withYear: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    expect(absoluteDayLabel("2025-10-01T02:00:00Z", withYear)).toBe("Oct 1, 2025");
    expect(absoluteDayLabel("2025-12-31", withYear)).toBe("Dec 31, 2025");
  });
});
