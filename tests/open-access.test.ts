// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  guestSignupsPerHour,
  guestWorkspaceSlug,
  isAuthPage,
  isBotUserAgent,
  isGuestCapReached,
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

describe("isBotUserAgent", () => {
  it("recognises crawlers and link-preview fetchers", () => {
    for (const ua of [
      "Googlebot/2.1",
      "Slackbot-LinkExpanding",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LinkPreview",
    ]) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it("lets browsers and missing user agents through", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
  });
});

describe("isGuestCapReached", () => {
  it("is reached at the limit and fails closed when the count is unavailable", () => {
    expect(isGuestCapReached(200, 200)).toBe(true);
    expect(isGuestCapReached(199, 200)).toBe(false);
    expect(isGuestCapReached(null, 200)).toBe(true);
  });
});

describe("guestSignupsPerHour", () => {
  it("uses a positive integer setting, else the default", () => {
    expect(guestSignupsPerHour("50")).toBe(50);
    expect(guestSignupsPerHour("x")).toBe(200);
  });
});
