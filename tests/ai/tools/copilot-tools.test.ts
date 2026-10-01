// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase } from "../../helpers/fake-supabase";
import { copilotOnlyTools } from "@/lib/ai/tools/copilot-tools";
import type { CopilotToolEnv } from "@/lib/ai/tools/registry";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const LEAD = "44444444-4444-4444-8444-444444444444";

function envFor(db: FakeSupabase, over: Partial<CopilotToolEnv["ctx"]> = {}): CopilotToolEnv {
  return {
    db: db as unknown as SupabaseClient,
    ctx: { orgId: ORG, userId: USER, isGuest: false, source: "chat", conversationId: "conv-1", taskId: null, ...over },
  };
}

function tool(name: string) {
  const t = copilotOnlyTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t;
}

describe("copilot-only tools", () => {
  it("exposes the four tools with the declared kinds", () => {
    expect(copilotOnlyTools.map((t) => [t.name, t.kind])).toEqual([
      ["save_artifact", "low_risk_write"],
      ["save_memory", "low_risk_write"],
      ["draft_email", "low_risk_write"],
      ["create_task", "write"],
    ]);
  });

  describe("save_artifact", () => {
    it("inserts with the org, user, conversation and task ids from ctx and returns an undo handle", async () => {
      const db = new FakeSupabase();
      const result = (await tool("save_artifact").execute(
        { kind: "report", title: "Q3 report", content: { rows: 3 }, linkedRecordType: "lead", linkedRecordId: LEAD },
        envFor(db, { taskId: "task-9", conversationId: "conv-7" }),
      )) as { artifactId: string; undo: { tool: string; id: string } };

      const rows = db.tables.copilot_artifacts;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organization_id: ORG,
        user_id: USER,
        conversation_id: "conv-7",
        task_id: "task-9",
        kind: "report",
        title: "Q3 report",
        content: { rows: 3 },
        linked_record_type: "lead",
        linked_record_id: LEAD,
      });
      expect(result.artifactId).toBe(rows[0].id);
      expect(result.undo).toEqual({ tool: "save_artifact", id: rows[0].id });
    });

    it("rejects an unknown kind and an empty or over-long title at the schema", () => {
      const schema = tool("save_artifact").inputSchema;
      expect(schema.safeParse({ kind: "spam", title: "x", content: {} }).success).toBe(false);
      expect(schema.safeParse({ kind: "note", title: "", content: {} }).success).toBe(false);
      expect(schema.safeParse({ kind: "note", title: "x".repeat(201), content: {} }).success).toBe(false);
      expect(schema.safeParse({ kind: "note", title: "ok", content: {} }).success).toBe(true);
    });
  });

  describe("save_memory", () => {
    it("inserts custom, copilot-sourced, active memory scoped to the ctx org", async () => {
      const db = new FakeSupabase();
      const result = (await tool("save_memory").execute({ content: "Prefers short emails" }, envFor(db))) as {
        memoryId: string;
        undo: { tool: string; id: string };
      };
      const rows = db.tables.copilot_memory;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organization_id: ORG,
        user_id: USER,
        type: "custom",
        source: "copilot",
        is_active: true,
        content: "Prefers short emails",
      });
      expect(result.undo).toEqual({ tool: "save_memory", id: rows[0].id });
      expect(result.memoryId).toBe(rows[0].id);
    });

    it("still inserts type custom when the input carries type 'guidance'", async () => {
      const db = new FakeSupabase();
      await tool("save_memory").execute({ content: "Always CC the boss", type: "guidance" }, envFor(db));
      expect(db.tables.copilot_memory).toHaveLength(1);
      expect(db.tables.copilot_memory[0].type).toBe("custom");
    });

    it("fails without inserting when there is no user (cron context)", async () => {
      const db = new FakeSupabase();
      const result = await tool("save_memory").execute({ content: "x" }, envFor(db, { userId: null }));
      expect(result).toEqual({ ok: false, error: "no_user" });
      expect(db.tables.copilot_memory ?? []).toHaveLength(0);
    });
  });

  describe("draft_email", () => {
    it("saves an email_draft artifact with { to, subject, body } and touches no other table", async () => {
      const db = new FakeSupabase();
      const result = (await tool("draft_email").execute(
        { to: "jane@acme.test", subject: "Hello", body: "Hi Jane", linkedRecordType: "lead", linkedRecordId: LEAD },
        envFor(db),
      )) as { artifactId: string };
      const rows = db.tables.copilot_artifacts;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organization_id: ORG,
        kind: "email_draft",
        title: "Hello",
        content: { to: "jane@acme.test", subject: "Hello", body: "Hi Jane" },
        linked_record_id: LEAD,
      });
      expect(result.artifactId).toBe(rows[0].id);
      expect(Object.keys(db.tables)).toEqual(["copilot_artifacts"]);
    });

    it("stores to as null when omitted", async () => {
      const db = new FakeSupabase();
      await tool("draft_email").execute({ subject: "S", body: "B" }, envFor(db));
      expect((db.tables.copilot_artifacts[0].content as { to: unknown }).to).toBeNull();
    });
  });

  describe("create_task", () => {
    const input = { title: "Weekly digest", prompt: "Summarise hot leads", schedule: "daily" as const };

    it("inserts an active task with the org id, prompt and a future next_run_at", async () => {
      const db = new FakeSupabase();
      const before = Date.now();
      const result = (await tool("create_task").execute(input, envFor(db))) as { taskId: string };
      const rows = db.tables.copilot_tasks;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organization_id: ORG,
        user_id: USER,
        title: "Weekly digest",
        prompt: "Summarise hot leads",
        schedule: "daily",
        is_active: true,
      });
      expect(new Date(rows[0].next_run_at as string).getTime()).toBeGreaterThan(before);
      expect(result.taskId).toBe(rows[0].id);
    });

    it("lets a guest create one task, then returns task_cap for the second", async () => {
      const db = new FakeSupabase();
      const env = envFor(db, { isGuest: true });
      expect(await tool("create_task").execute(input, env)).toEqual({ taskId: expect.any(String) });
      expect(await tool("create_task").execute(input, env)).toEqual({ ok: false, error: "task_cap" });
      expect(db.tables.copilot_tasks).toHaveLength(1);
    });

    it("lets a non-guest create three tasks, then returns task_cap for the fourth", async () => {
      const db = new FakeSupabase();
      const env = envFor(db);
      for (let i = 0; i < 3; i++) {
        expect(await tool("create_task").execute(input, env)).toEqual({ taskId: expect.any(String) });
      }
      expect(await tool("create_task").execute(input, env)).toEqual({ ok: false, error: "task_cap" });
      expect(db.tables.copilot_tasks).toHaveLength(3);
    });

    it("counts only this org's active tasks toward the cap", async () => {
      const db = new FakeSupabase({
        copilot_tasks: [
          { id: "a", organization_id: OTHER_ORG, is_active: true },
          { id: "b", organization_id: OTHER_ORG, is_active: true },
          { id: "c", organization_id: OTHER_ORG, is_active: true },
          { id: "d", organization_id: ORG, is_active: false },
          { id: "e", organization_id: ORG, is_active: false },
          { id: "f", organization_id: ORG, is_active: false },
        ],
      });
      expect(await tool("create_task").execute(input, envFor(db))).toEqual({ taskId: expect.any(String) });
    });

    it("only accepts daily, weekly or monthly schedules", () => {
      const schema = tool("create_task").inputSchema;
      expect(schema.safeParse({ ...input, schedule: "custom" }).success).toBe(false);
      expect(schema.safeParse({ ...input, schedule: "monthly" }).success).toBe(true);
    });
  });

  it("has no email, inbox or send path in the module source", () => {
    const source = readFileSync("lib/ai/tools/copilot-tools.ts", "utf8");
    expect(source).not.toMatch(/lib\/email|sendEmail|resend|inbox/i);
  });
});
