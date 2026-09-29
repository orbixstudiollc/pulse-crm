// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatEnumLabel } from "@/lib/utils/format-enum-label";

describe("formatEnumLabel", () => {
  it("returns an empty string for null, undefined and blank values", () => {
    expect(formatEnumLabel(null)).toBe("");
    expect(formatEnumLabel(undefined)).toBe("");
    expect(formatEnumLabel("")).toBe("");
    expect(formatEnumLabel("   ")).toBe("");
  });

  it("maps known providers to their display names", () => {
    expect(formatEnumLabel("gmail")).toBe("Gmail");
    expect(formatEnumLabel("outlook")).toBe("Outlook");
    expect(formatEnumLabel("smtp")).toBe("SMTP");
    expect(formatEnumLabel("imap")).toBe("IMAP");
    expect(formatEnumLabel("custom_imap")).toBe("IMAP/SMTP");
  });

  it("matches special cases case-insensitively", () => {
    expect(formatEnumLabel("GMAIL")).toBe("Gmail");
    expect(formatEnumLabel("Custom_IMAP")).toBe("IMAP/SMTP");
  });

  it("replaces underscores and hyphens and capitalises the first letter", () => {
    expect(formatEnumLabel("schedule_daily")).toBe("Schedule daily");
    expect(formatEnumLabel("every-two-weeks")).toBe("Every two weeks");
    expect(formatEnumLabel("WEEKLY")).toBe("Weekly");
  });

  it("collapses repeated separators and whitespace", () => {
    expect(formatEnumLabel("a__b -- c")).toBe("A b c");
  });
});
