import { describe, expect, it } from "vitest";
import { businessEmailDomain, mailboxIsReady, normalizeQuickLeadInput, recordVersion, sameRecordVersion, retryDelay } from "@/lib/twenty/workflows/types";

describe("Twenty workflow trigger rules", () => {
  it("recognizes business domains and excludes personal and malformed addresses", () => {
    expect(businessEmailDomain("a@OrbixStudio.com")).toBe("orbixstudio.com");
    for (const email of ["a@gmail.com", "a@googlemail.com", "a@outlook.com", "a@proton.me", "not an email", undefined]) expect(businessEmailDomain(email)).toBeNull();
  });
  it("requires all mailbox readiness conditions, including threshold boundaries", () => {
    const ready = { status: "ACTIVE", healthScore: 90, spamPlacementRate: 0.1 };
    expect(mailboxIsReady(ready)).toBe(true);
    expect(mailboxIsReady({ ...ready, healthScore: 89.99 })).toBe(false);
    expect(mailboxIsReady({ ...ready, spamPlacementRate: 0.1001 })).toBe(false);
    expect(mailboxIsReady({ ...ready, status: "WARMING" })).toBe(false);
    expect(mailboxIsReady({ status: "ACTIVE" })).toBe(false);
  });
  it("normalizes optional empty fields from the person-only Quick Lead form", () => {
    expect(normalizeQuickLeadInput({ firstName: "A", lastName: "", email: "a@example.com", jobTitle: "", companyName: "", companyDomain: " " })).toEqual({ firstName: "A", lastName: "", email: "a@example.com" });
    // Keep unknown keys for the strict tool schema to reject; never silently strip them.
    expect(normalizeQuickLeadInput({ endpoint: "https://evil.example" })).toHaveProperty("endpoint");
    expect(() => normalizeQuickLeadInput(null)).toThrow();
  });
  it("canonicalizes timestamps for deduplication and refuses unversioned records", () => {
    expect(recordVersion({ id: "x", updatedAt: "2026-10-11T12:00:00+02:00" })).toBe("2026-10-11T10:00:00.000Z");
    expect(() => recordVersion({ id: "x" })).toThrow();
  });
  it("bounds exponential retries", () => {
    expect(retryDelay(1)).toBe(30_000);
    expect(retryDelay(5)).toBe(480_000);
    expect(retryDelay(20)).toBe(3_600_000);
  });
  it("compares timezone formatting without dropping fractional record versions", () => {
    expect(sameRecordVersion("2026-10-11T10:00:00.000Z", "2026-10-11T12:00:00+02:00")).toBe(true);
    expect(sameRecordVersion("2026-10-11T10:00:00.000001Z", "2026-10-11T10:00:00.000002+00:00")).toBe(false);
    expect(recordVersion({ id: "x", updatedAt: "2026-10-11T10:00:00.000001Z" })).toContain(".000001Z");
    expect(sameRecordVersion("invalid", "invalid")).toBe(false);
  });
});
