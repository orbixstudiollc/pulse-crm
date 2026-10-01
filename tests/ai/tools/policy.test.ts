// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "@/lib/mcp/tools-read";
import { registerWriteTools } from "@/lib/mcp/tools-write";
import type { Db } from "@/lib/mcp/shared";
import {
  COPILOT_READ_TOOLS,
  COPILOT_WRITE_TOOLS,
  LOW_RISK_WRITES,
  NEVER_AUTO_ALLOW,
  TASK_MODE_EXCLUDED,
  UI_TOOLS,
  WRITE_FANOUT_PER_TURN,
  isAlwaysAllowed,
  sanitizeAlwaysAllow,
} from "@/lib/ai/tools/policy";
import { TOOL_LABELS } from "@/lib/ai/tools/labels";

/** Names lib/mcp registers, read from a recording stand-in for McpServer. */
function mcpToolNames() {
  const read: string[] = [];
  const write: string[] = [];
  let sink = read;
  const recorder = { registerTool: (name: string) => void sink.push(name) } as unknown as McpServer;
  const env = { db: null as unknown as Db, ctx: { keyId: "k", orgId: "o", scope: "write" as const, createdBy: null } };
  registerReadTools(recorder, env);
  sink = write;
  registerWriteTools(recorder, env);
  return { read, write };
}

const BULK = /^bulk_|_many$/;

describe("copilot tool allowlists", () => {
  const mcp = mcpToolNames();

  it("exposes exactly the 12 MCP read tools", () => {
    expect(COPILOT_READ_TOOLS).toHaveLength(12);
    expect([...COPILOT_READ_TOOLS].sort()).toEqual([...mcp.read].sort());
  });

  it("allows every MCP write tool except delete_record and bulk tools", () => {
    const expected = mcp.write.filter((n) => n !== "delete_record" && !BULK.test(n));
    expect([...COPILOT_WRITE_TOOLS].sort()).toEqual(expected.sort());
    expect(COPILOT_WRITE_TOOLS).not.toContain("delete_record");
  });

  it("NEVER_AUTO_ALLOW covers delete_record and every bulk tool lib/mcp registers", () => {
    const dangerous = [...mcp.read, ...mcp.write].filter((n) => n === "delete_record" || BULK.test(n));
    expect(dangerous).toContain("delete_record");
    for (const name of dangerous) expect(NEVER_AUTO_ALLOW).toContain(name);
    for (const name of NEVER_AUTO_ALLOW) expect(COPILOT_WRITE_TOOLS).not.toContain(name);
  });

  it("pins the limits and the copilot-only lists", () => {
    expect(WRITE_FANOUT_PER_TURN).toBe(20);
    expect(LOW_RISK_WRITES).toEqual(["save_artifact", "save_memory", "draft_email"]);
    // An unattended task run can neither create tasks nor persist workspace memory, and has nobody to pick a next step.
    expect(TASK_MODE_EXCLUDED).toEqual(["create_task", "save_memory", "suggest_next"]);
    expect(UI_TOOLS).toEqual(["suggest_next"]);
    for (const name of UI_TOOLS) {
      expect(COPILOT_WRITE_TOOLS).not.toContain(name);
      expect(LOW_RISK_WRITES as readonly string[]).not.toContain(name);
    }
  });
});

describe("isAlwaysAllowed", () => {
  it("never auto-allows delete_record, even when listed", () => {
    expect(isAlwaysAllowed("delete_record", ["delete_record"])).toBe(false);
  });

  it("allows a listed allowlisted write tool", () => {
    expect(isAlwaysAllowed("update_lead", ["update_lead", "create_deal"])).toBe(true);
  });

  it("is false when the tool is not listed", () => {
    expect(isAlwaysAllowed("update_lead", ["create_deal"])).toBe(false);
  });

  it("is false for names outside the write allowlist (create_task, low-risk saves, unknown)", () => {
    expect(isAlwaysAllowed("create_task", ["create_task"])).toBe(false);
    expect(isAlwaysAllowed("save_memory", ["save_memory"])).toBe(false);
    expect(isAlwaysAllowed("bulk_update_leads", ["bulk_update_leads"])).toBe(false);
  });

  it("is false for anything that is not a string array", () => {
    expect(isAlwaysAllowed("update_lead", "update_lead")).toBe(false);
    expect(isAlwaysAllowed("update_lead", null)).toBe(false);
    expect(isAlwaysAllowed("update_lead", { update_lead: true })).toBe(false);
    expect(isAlwaysAllowed("update_lead", ["update_lead", 7])).toBe(false);
  });
});

describe("sanitizeAlwaysAllow", () => {
  it("keeps allowlisted names once and drops everything else", () => {
    expect(
      sanitizeAlwaysAllow(["update_lead", "delete_record", "update_lead", 3, "save_memory", "nope", "create_deal"]),
    ).toEqual(["update_lead", "create_deal"]);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeAlwaysAllow(undefined)).toEqual([]);
    expect(sanitizeAlwaysAllow("update_lead")).toEqual([]);
    expect(sanitizeAlwaysAllow({ 0: "update_lead" })).toEqual([]);
  });
});

describe("TOOL_LABELS", () => {
  it("labels every tool the Copilot can call", () => {
    for (const name of [...COPILOT_READ_TOOLS, ...COPILOT_WRITE_TOOLS, ...LOW_RISK_WRITES, ...TASK_MODE_EXCLUDED]) {
      expect(TOOL_LABELS[name], name).toBeTruthy();
    }
    expect(TOOL_LABELS.search_leads).toBe("Searched leads");
    expect(TOOL_LABELS.draft_email).toBe("Drafted email");
  });
});
