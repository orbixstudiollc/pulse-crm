// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeTimezone } from "@/lib/settings/timezone";

describe("normalizeTimezone", () => {
  it("maps legacy short codes to IANA zones", () => {
    expect(normalizeTimezone("pt", "UTC")).toBe("America/Los_Angeles");
    expect(normalizeTimezone("mt", "UTC")).toBe("America/Denver");
    expect(normalizeTimezone("ct", "UTC")).toBe("America/Chicago");
    expect(normalizeTimezone("et", "UTC")).toBe("America/New_York");
    expect(normalizeTimezone("utc", "Europe/Paris")).toBe("UTC");
    expect(normalizeTimezone("gmt", "Europe/Paris")).toBe("UTC");
  });

  it("matches legacy codes case-insensitively and ignores surrounding whitespace", () => {
    expect(normalizeTimezone("PT", "UTC")).toBe("America/Los_Angeles");
    expect(normalizeTimezone(" Et ", "UTC")).toBe("America/New_York");
    expect(normalizeTimezone("GMT", "Europe/Paris")).toBe("UTC");
  });

  it("returns other values unchanged", () => {
    expect(normalizeTimezone("Europe/London", "UTC")).toBe("Europe/London");
    expect(normalizeTimezone("Asia/Kolkata", "UTC")).toBe("Asia/Kolkata");
  });

  it("returns the fallback for null, undefined and blank values", () => {
    expect(normalizeTimezone(null, "Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(normalizeTimezone(undefined, "Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(normalizeTimezone("", "Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(normalizeTimezone("   ", "Asia/Tokyo")).toBe("Asia/Tokyo");
  });
});
