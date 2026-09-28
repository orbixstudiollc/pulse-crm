// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  guestWorkspaceSlug,
  isAuthPage,
  isGuestEmail,
  isOpenAccess,
} from "@/lib/auth/open-access";

describe("isOpenAccess", () => {
  it("is on only for the literal string true", () => {
    expect(isOpenAccess("true")).toBe(true);
    expect(isOpenAccess("1")).toBe(false);
    expect(isOpenAccess("TRUE")).toBe(false);
    expect(isOpenAccess("")).toBe(false);
    expect(isOpenAccess(undefined)).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("matches the auth routes and their children", () => {
    for (const p of ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/onboarding", "/onboarding/step-2"]) {
      expect(isAuthPage(p)).toBe(true);
    }
  });

  it("does not match dashboard, api or lookalike paths", () => {
    for (const p of ["/", "/dashboard/overview", "/api/cron/daily-reset", "/loginx", "/signups"]) {
      expect(isAuthPage(p)).toBe(false);
    }
  });
});

describe("guestWorkspaceSlug", () => {
  it("is deterministic for a user and timestamp and safe for a slug column", () => {
    const slug = guestWorkspaceSlug("123e4567-e89b-12d3-a456-426614174000", 1700000000000);
    expect(slug).toBe("guest-123e4567-1700000000000");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("isGuestEmail", () => {
  it("recognises the synthetic guest address only", () => {
    expect(isGuestEmail("abc@guest.local")).toBe(true);
    expect(isGuestEmail("someone@example.com")).toBe(false);
    expect(isGuestEmail(null)).toBe(false);
  });
});
