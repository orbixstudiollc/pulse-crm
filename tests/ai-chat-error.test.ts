// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeChatError } from "@/lib/ai/chat-error";

describe("describeChatError", () => {
  it("flags the missing-key error regardless of case", () => {
    const err = new Error("No AI API key configured. Add one in Settings > AI or set ANTHROPIC_API_KEY.");
    expect(describeChatError(err)).toEqual({ message: "Add an AI API key to use the assistant.", needsKey: true });
    expect(describeChatError(new Error("no ai api KEY"))).toEqual({
      message: "Add an AI API key to use the assistant.",
      needsKey: true,
    });
  });

  it("returns other Error messages trimmed to 200 characters", () => {
    expect(describeChatError(new Error("Rate limit exceeded"))).toEqual({ message: "Rate limit exceeded", needsKey: false });
    const long = describeChatError(new Error("x".repeat(500)));
    expect(long.message).toHaveLength(200);
    expect(long.needsKey).toBe(false);
  });

  it("returns a generic message for non-Error values", () => {
    const generic = { message: "Something went wrong. Please try again.", needsKey: false };
    expect(describeChatError("boom")).toEqual(generic);
    expect(describeChatError(undefined)).toEqual(generic);
    expect(describeChatError({ message: "No AI API key" })).toEqual(generic);
  });
});
