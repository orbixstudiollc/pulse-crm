import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAnthropic } from "@ai-sdk/anthropic";
import { simulateStreamingMiddleware, streamText, tool, wrapLanguageModel } from "ai";
import { z } from "zod";
import { createPinnedFetch } from "@/lib/security/safe-fetch";

let server: http.Server;
let port = 0;
const seen: { stream: unknown }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      seen.push({ stream: parsed.stream });
      const hasToolResult = JSON.stringify(parsed.messages).includes("tool_result");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "m1",
          type: "message",
          role: "assistant",
          model: "x",
          content: hasToolResult
            ? [{ type: "text", text: "Done." }]
            : [{ type: "tool_use", id: "tu1", name: "lookup", input: { id: "00000000-0000-4000-8000-000000000001" } }],
          stop_reason: hasToolResult ? "end_turn" : "tool_use",
          usage: { input_tokens: 5, output_tokens: 3 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

describe("custom relay via simulated streaming", () => {
  it("runs a tool call and a final answer without streaming requests", async () => {
    const target = { url: new URL(`http://relay.test:${port}`), addresses: [{ address: "127.0.0.1", family: 4 }] };
    const pinned = createPinnedFetch(target as never);
    const anthropic = createAnthropic({ apiKey: "test", baseURL: `http://relay.test:${port}/v1`, fetch: pinned.fetch });
    const errors: unknown[] = [];
    const result = streamText({
      model: wrapLanguageModel({ model: anthropic("claude-sonnet-4.6"), middleware: simulateStreamingMiddleware() }),
      prompt: "look it up",
      tools: { lookup: tool({ description: "d", inputSchema: z.object({ id: z.guid() }), execute: async () => "found" }) },
      stopWhen: ({ steps }) => steps.length >= 3,
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    const text = await result.text;
    const steps = await result.steps;
    await pinned.close();
    expect(errors).toEqual([]);
    expect(seen.every((s) => s.stream !== true)).toBe(true);
    expect(steps.length).toBe(2);
    expect(steps[0].toolCalls[0]?.toolName).toBe("lookup");
    expect(text).toBe("Done.");
  });
});
