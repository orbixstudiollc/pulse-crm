// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createOAuthState, stateMatches } from "@/lib/security/oauth-state";

describe("createOAuthState", () => {
  it("returns 32 random bytes as base64url (43 chars, url-safe charset)", () => {
    const state = createOAuthState();
    expect(state).toHaveLength(43);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(state, "base64url")).toHaveLength(32);
  });

  it("returns a different value each call", () => {
    expect(createOAuthState()).not.toBe(createOAuthState());
  });
});

describe("stateMatches", () => {
  it("returns true when cookie and state are equal", () => {
    const state = createOAuthState();
    expect(stateMatches(state, state)).toBe(true);
  });

  it("returns false on mismatch, including different lengths", () => {
    expect(stateMatches(createOAuthState(), createOAuthState())).toBe(false);
    expect(stateMatches("abc", "abcd")).toBe(false);
  });

  it("returns false when either side is missing", () => {
    expect(stateMatches(undefined, "abc")).toBe(false);
    expect(stateMatches("abc", null)).toBe(false);
    expect(stateMatches("", "")).toBe(false);
    expect(stateMatches(undefined, null)).toBe(false);
  });
});
