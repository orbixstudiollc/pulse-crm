// @vitest-environment node
import { describe, expect, it } from "vitest";
import { countInMonth, monthOverMonth } from "@/lib/stats/period-delta";

describe("monthOverMonth", () => {
  it("returns null when both months are zero", () => {
    expect(monthOverMonth(0, 0)).toBeNull();
  });

  it("reports new activity when last month was zero", () => {
    expect(monthOverMonth(5, 0)).toEqual({ text: "New this month", trend: "up" });
  });

  it("formats an increase with a plus sign and one decimal", () => {
    expect(monthOverMonth(9, 8)).toEqual({ text: "+12.5%", trend: "up" });
    expect(monthOverMonth(20, 10)).toEqual({ text: "+100.0%", trend: "up" });
  });

  it("formats a decrease with a minus sign and one decimal", () => {
    expect(monthOverMonth(97, 100)).toEqual({ text: "-3.0%", trend: "down" });
    expect(monthOverMonth(0, 4)).toEqual({ text: "-100.0%", trend: "down" });
  });

  it("returns flat 0% when nothing changed", () => {
    expect(monthOverMonth(7, 7)).toEqual({ text: "0%", trend: "flat" });
  });

  it("treats a change that rounds to zero as flat", () => {
    expect(monthOverMonth(10001, 10000)).toEqual({ text: "0%", trend: "flat" });
  });
});

describe("countInMonth", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  const dates = [
    "2026-03-01T00:00:00Z",
    "2026-03-31T23:59:59Z",
    "2026-02-01T00:00:00Z",
    "2026-02-28T23:59:59Z",
    "2026-02-10T00:00:00Z",
    "2026-01-31T23:59:59Z",
    "2026-04-01T00:00:00Z",
    null,
    undefined,
    "",
  ];

  it("counts dates in the current UTC month", () => {
    expect(countInMonth(dates, 0, now)).toBe(2);
  });

  it("counts dates in the previous UTC month", () => {
    expect(countInMonth(dates, -1, now)).toBe(3);
  });

  it("rolls the previous month back across a year boundary", () => {
    const jan = new Date("2026-01-10T00:00:00Z");
    expect(countInMonth(["2025-12-05T00:00:00Z", "2026-01-02T00:00:00Z"], -1, jan)).toBe(1);
    expect(countInMonth(["2025-12-05T00:00:00Z", "2026-01-02T00:00:00Z"], 0, jan)).toBe(1);
  });

  it("returns 0 for an empty list and defaults now to the current date", () => {
    expect(countInMonth([], 0)).toBe(0);
    expect(countInMonth([new Date().toISOString()], 0)).toBe(1);
  });
});
