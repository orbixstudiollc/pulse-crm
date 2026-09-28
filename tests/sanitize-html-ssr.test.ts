import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/lib/security/sanitize-html";

describe("sanitizeEmailHtml without a DOM", () => {
  it("fails closed and returns an empty string", () => {
    expect(sanitizeEmailHtml("<p>hi</p>")).toBe("");
  });
});
