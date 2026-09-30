// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  guestSignupsPerHour,
  guestWorkspaceSlug,
  isAuthPage,
  isBotUserAgent,
  isClientFetch,
  isGuestCapReached,
  isGuestEmail,
  isOpenAccess,
  shouldProvisionGuest,
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
      "bingbot/2.0",
      "AhrefsBot",
      "Twitterbot",
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

  it("does not flag user agents that merely contain the letters bot", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36",
      "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
    ]) {
      expect(isBotUserAgent(ua)).toBe(false);
    }
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

describe("shouldProvisionGuest", () => {
  const CHROME =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const navigation = {
    method: "GET",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    secFetchMode: "navigate",
    secFetchDest: "document",
    userAgent: CHROME,
  };

  it("is true for a browser page navigation", () => {
    expect(shouldProvisionGuest(navigation)).toBe(true);
  });

  it("is true for a browser without Fetch Metadata that asks for HTML", () => {
    expect(shouldProvisionGuest({ ...navigation, secFetchMode: null, secFetchDest: null })).toBe(true);
    expect(shouldProvisionGuest({ ...navigation, secFetchMode: undefined, secFetchDest: undefined })).toBe(true);
  });

  it("is false for HEAD and other methods", () => {
    for (const method of ["HEAD", "head", "POST", "OPTIONS"]) {
      expect(shouldProvisionGuest({ ...navigation, method })).toBe(false);
    }
  });

  it("is false for curl-style requests that accept anything", () => {
    expect(
      shouldProvisionGuest({ method: "GET", accept: "*/*", secFetchMode: null, secFetchDest: null, userAgent: "curl/8.4.0" }),
    ).toBe(false);
    expect(shouldProvisionGuest({ ...navigation, accept: "*/*" })).toBe(false);
    expect(shouldProvisionGuest({ ...navigation, accept: null })).toBe(false);
  });

  it("is false for prefetch and RSC fetches that are not navigations", () => {
    for (const secFetchMode of ["cors", "no-cors", "same-origin", ""]) {
      expect(shouldProvisionGuest({ ...navigation, secFetchMode })).toBe(false);
    }
    expect(shouldProvisionGuest({ ...navigation, secFetchMode: null, secFetchDest: "empty" })).toBe(false);
  });

  it("is false for navigations into a frame rather than the top document", () => {
    expect(shouldProvisionGuest({ ...navigation, secFetchDest: "iframe" })).toBe(false);
  });

  it("is false for bot user agents even when they look like a navigation", () => {
    expect(shouldProvisionGuest({ ...navigation, userAgent: "Googlebot/2.1" })).toBe(false);
  });
});

describe("isClientFetch", () => {
  it("is true for a GET fetch() that is not a navigation", () => {
    for (const secFetchMode of ["cors", "same-origin", "no-cors"]) {
      expect(isClientFetch({ method: "GET", secFetchMode, secFetchDest: "empty" })).toBe(true);
    }
    expect(isClientFetch({ method: "get", secFetchMode: "cors", secFetchDest: null })).toBe(true);
  });

  it("is false for page navigations", () => {
    expect(isClientFetch({ method: "GET", secFetchMode: "navigate", secFetchDest: "document" })).toBe(false);
    expect(isClientFetch({ method: "GET", secFetchMode: "navigate", secFetchDest: "iframe" })).toBe(false);
  });

  it("is false without Fetch Metadata", () => {
    expect(isClientFetch({ method: "GET", secFetchMode: null, secFetchDest: null })).toBe(false);
    expect(isClientFetch({ method: "GET", secFetchMode: undefined, secFetchDest: "empty" })).toBe(false);
  });

  it("is false for POST server actions, HEAD and other methods", () => {
    for (const method of ["POST", "HEAD", "OPTIONS", "PUT"]) {
      expect(isClientFetch({ method, secFetchMode: "cors", secFetchDest: "empty" })).toBe(false);
    }
  });
});
