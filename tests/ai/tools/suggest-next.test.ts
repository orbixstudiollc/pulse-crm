// @vitest-environment node
// suggest_next through the real registry (registry.test.ts stubs the copilot-only tools).
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "ai";
import { FakeSupabase } from "../../helpers/fake-supabase";

vi.mock("@/lib/automation/runner", () => ({ evaluateLeadAgainstRules: vi.fn(async () => ({ skipped: [] })) }));

import { buildCopilotToolSet, executeRegistryTool, listRegistryTools, type CopilotToolEnv } from "@/lib/ai/tools/registry";
import { COPILOT_WRITE_TOOLS } from "@/lib/ai/tools/policy";
import { selectActiveTools } from "@/lib/ai/tools/select";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "33333333-3333-4333-8333-333333333333";

function envFor(db: FakeSupabase, source: "chat" | "task" = "chat"): CopilotToolEnv {
  return {
    db: db as unknown as SupabaseClient,
    ctx: { orgId: ORG, userId: USER, isGuest: false, source, conversationId: source === "chat" ? "conv-1" : null, taskId: null },
  };
}

const options = { question: "Which lead first?", options: [{ label: "Acme", prompt: "Open the Acme lead." }] };

describe("suggest_next", () => {
  it("is a chat tool that is not a write, and is left out of task mode", () => {
    const chat = listRegistryTools("chat").find((t) => t.name === "suggest_next");
    expect(chat).toBeDefined();
    expect(chat!.kind).toBe("read");
    expect(listRegistryTools("task").map((t) => t.name)).not.toContain("suggest_next");
  });

  it("needs no approval, counts toward no fan-out and writes nothing", async () => {
    const db = new FakeSupabase();
    const onWriteRequested = vi.fn(async () => undefined);
    const fanout = { count: 0 };
    const tools = buildCopilotToolSet(envFor(db), { alwaysAllow: [], onWriteRequested, fanout });
    const tool = tools.suggest_next as Tool;

    expect(tool.needsApproval).toBeUndefined();
    const run = tool.execute as unknown as (input: unknown, opts: unknown) => Promise<unknown>;
    expect(await run(options, { toolCallId: "call-1", messages: [] })).toEqual({ ok: true, data: { ok: true } });
    expect(onWriteRequested).not.toHaveBeenCalled();
    expect(fanout.count).toBe(0);
    expect(db.log).toEqual([]);
  });

  it("validates its options: 1-4 options with a 1-40 character label", async () => {
    const env = envFor(new FakeSupabase());
    expect((await executeRegistryTool("suggest_next", { options: [] }, env)).ok).toBe(false);
    expect((await executeRegistryTool("suggest_next", { options: [{ label: "x".repeat(41), prompt: "p" }] }, env)).ok).toBe(false);
    const five = Array.from({ length: 5 }, (_, i) => ({ label: `Option ${i}`, prompt: "p" }));
    expect((await executeRegistryTool("suggest_next", { options: five }, env)).ok).toBe(false);
    expect((await executeRegistryTool("suggest_next", options, env)).ok).toBe(true);
  });

  it("stays active for a read-only question", () => {
    const active = selectActiveTools({
      allTools: listRegistryTools("chat").map((t) => t.name),
      writeTools: COPILOT_WRITE_TOOLS,
      messageText: "Which leads are hot?",
      answeringApprovals: false,
      lastAssistantText: null,
      historyToolNames: [],
    });
    expect(active).toContain("suggest_next");
    expect(active).not.toContain("update_lead");
  });
});
