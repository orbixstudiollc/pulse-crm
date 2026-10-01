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

  it("flags the not-set-up message the chat route and AI client now return", () => {
    const err = new Error("AI isn't set up for this workspace yet. Add a provider in Settings → AI Assistant.");
    expect(describeChatError(err)).toEqual({ message: "Add an AI API key to use the assistant.", needsKey: true });
    expect(describeChatError(new Error("ai ISN'T SET UP for this workspace yet"))).toEqual({
      message: "Add an AI API key to use the assistant.",
      needsKey: true,
    });
  });

  it("does not flag the shared-key limit messages as a missing key", () => {
    for (const message of [
      "Today's AI limit for this workspace is used up. It resets at midnight UTC.",
      "AI is busy right now. Please try again later.",
    ]) {
      expect(describeChatError(new Error(message))).toEqual({ message, needsKey: false });
    }
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

describe("describeProviderError", () => {
  it("summarises status, host and cause on one short line without the request body", async () => {
    const { describeProviderError } = await import("@/lib/ai/chat-error");
    const cause = Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" });
    const err = Object.assign(new Error("Failed to process successful response"), {
      name: "AI_APICallError",
      statusCode: 200,
      url: "https://relay.example.com/v1/messages",
      cause,
      requestBodyValues: { messages: ["secret prompt"] },
    });
    const line = describeProviderError(err);
    expect(line).toContain("AI_APICallError: Failed to process successful response");
    expect(line).toContain("status=200");
    expect(line).toContain("host=relay.example.com");
    expect(line).toContain("cause=Error: other side closed (UND_ERR_SOCKET)");
    expect(line).not.toContain("secret prompt");
    expect(line.length).toBeLessThan(1200);
  });
});
