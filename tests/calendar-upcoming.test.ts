// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eventWindow, isUpcoming, toMinutes, upcomingEvents } from "@/lib/calendar/upcoming";

const NOW = new Date(2026, 9, 1, 10, 0); // 1 Oct 2026 10:00 (local)

const timed = (date: string, startTime: string, durationMin = 30, status: string | null = "scheduled") => ({
  date,
  startTime,
  allDay: false,
  durationMin,
  status,
});
const allDay = (date: string, status: string | null = "scheduled") => ({
  date,
  startTime: "09:00",
  allDay: true,
  durationMin: 30,
  status,
});

describe("toMinutes", () => {
  it("parses HH:MM and HH:MM:SS", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("14:05:00")).toBe(845);
  });

  it("returns null for missing or malformed times", () => {
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
    expect(toMinutes("soon")).toBeNull();
  });
});

describe("eventWindow", () => {
  it("runs from the local start for the duration", () => {
    const { start, end } = eventWindow(timed("2026-10-01", "09:45", 60));
    expect(start).toEqual(new Date(2026, 9, 1, 9, 45));
    expect(end).toEqual(new Date(2026, 9, 1, 10, 45));
  });

  it("spans the whole local day for an all-day event", () => {
    const { start, end } = eventWindow(allDay("2026-10-01"));
    expect(start).toEqual(new Date(2026, 9, 1));
    expect(end).toEqual(new Date(2026, 9, 2));
  });
});

describe("isUpcoming", () => {
  it("keeps an event that started but has not ended", () => {
    expect(isUpcoming(timed("2026-10-01", "09:45", 30), NOW)).toBe(true);
  });

  it("drops an event that has ended", () => {
    expect(isUpcoming(timed("2026-10-01", "09:00", 30), NOW)).toBe(false);
    expect(isUpcoming(timed("2026-10-01", "09:30", 30), NOW)).toBe(false);
  });

  it("keeps an all-day event for the rest of its day, not past a 09:00 default", () => {
    expect(isUpcoming(allDay("2026-10-01"), NOW)).toBe(true);
    expect(isUpcoming(allDay("2026-10-01"), new Date(2026, 9, 1, 23, 59))).toBe(true);
    expect(isUpcoming(allDay("2026-09-30"), NOW)).toBe(false);
  });

  it("treats a null status as open and skips completed or cancelled events", () => {
    expect(isUpcoming(timed("2026-10-02", "09:00", 30, null), NOW)).toBe(true);
    expect(isUpcoming(timed("2026-10-02", "09:00", 30, "completed"), NOW)).toBe(false);
    expect(isUpcoming(timed("2026-10-02", "09:00", 30, "cancelled"), NOW)).toBe(false);
  });
});

describe("upcomingEvents", () => {
  it("filters and sorts by start, with all-day events leading their day", () => {
    const events = [
      { id: "later", ...timed("2026-10-02", "08:00") },
      { id: "past", ...timed("2026-09-30", "15:00") },
      { id: "now", ...timed("2026-10-01", "09:50", 30) },
      { id: "allday", ...allDay("2026-10-02") },
      { id: "done", ...timed("2026-10-01", "11:00", 30, "completed") },
    ];
    expect(upcomingEvents(events, NOW).map((e) => e.id)).toEqual(["now", "allday", "later"]);
  });
});
