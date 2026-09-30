// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  customerLifetimeValue,
  customerTenureMonths,
} from "@/lib/customers/metrics";

const NOW = new Date(2026, 9, 15); // 15 Oct 2026 (local)

describe("customerTenureMonths", () => {
  it("counts whole calendar months from customerSince", () => {
    expect(customerTenureMonths("2026-01-10T12:00:00", null, NOW)).toBe(9);
  });

  it("falls back to createdAt when customerSince is missing", () => {
    expect(customerTenureMonths(null, "2025-10-05T12:00:00", NOW)).toBe(12);
    expect(customerTenureMonths(undefined, "2025-10-05T12:00:00", NOW)).toBe(12);
  });

  it("prefers customerSince over createdAt", () => {
    expect(
      customerTenureMonths("2026-08-05T12:00:00", "2020-01-01T12:00:00", NOW),
    ).toBe(2);
  });

  it("returns 0 when both dates are missing or invalid", () => {
    expect(customerTenureMonths(null, null, NOW)).toBe(0);
    expect(customerTenureMonths("not-a-date", undefined, NOW)).toBe(0);
  });

  it("never returns below 0 for future dates", () => {
    expect(customerTenureMonths("2027-03-01T12:00:00", null, NOW)).toBe(0);
  });

  it("returns 0 within the same calendar month", () => {
    expect(customerTenureMonths("2026-10-01T12:00:00", null, NOW)).toBe(0);
  });
});

describe("customerTenureMonths with date-only values (west of UTC)", () => {
  let previousTz: string | undefined;

  beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it("parses a date-only customerSince as a local date", () => {
    expect(customerTenureMonths("2026-03-01", null, NOW)).toBe(7);
  });

  it("returns 0 for a date-only value on the first of the current month", () => {
    expect(customerTenureMonths("2026-10-01", null, NOW)).toBe(0);
  });

  it("parses a date-only createdAt fallback as a local date", () => {
    expect(customerTenureMonths(null, "2026-03-01", NOW)).toBe(7);
  });
});

describe("customerLifetimeValue", () => {
  it("uses the stored value when positive", () => {
    expect(customerLifetimeValue(5000, 1200)).toBe(5000);
  });

  it("falls back to closed-won total when stored is 0, null or undefined", () => {
    expect(customerLifetimeValue(0, 1200)).toBe(1200);
    expect(customerLifetimeValue(null, 1200)).toBe(1200);
    expect(customerLifetimeValue(undefined, 1200)).toBe(1200);
  });

  it("defaults closed-won total to 0", () => {
    expect(customerLifetimeValue(null)).toBe(0);
  });

  it("ignores negative stored values", () => {
    expect(customerLifetimeValue(-10, 300)).toBe(300);
  });
});
