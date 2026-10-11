import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { FakeSupabase } from "../helpers/fake-supabase";

const ownerCheck = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/twenty/connections", () => ({ assertTwentyOwner: ownerCheck }));
import { conversationBinding, loadTwentyMemory } from "@/lib/ai/crm-source";

const ORG = "org", USER = "owner", CONNECTION = "twenty-a";
const admin = (db: FakeSupabase) => db as unknown as SupabaseClient<Database>;

describe("CRM source boundaries", () => {
  beforeEach(() => { ownerCheck.mockReset(); ownerCheck.mockResolvedValue(undefined); });
  it("defaults new conversations to Pulse and refuses a Pulse connection", async () => {
    const db = admin(new FakeSupabase({}));
    await expect(conversationBinding(db, { orgId: ORG, userId: USER })).resolves.toEqual({ crmSource: "pulse", connectionId: null });
    await expect(conversationBinding(db, { orgId: ORG, userId: USER, connectionId: CONNECTION })).rejects.toThrow("invalid_crm_binding");
    expect(ownerCheck).not.toHaveBeenCalled();
  });
  it("uses the stored source and rejects switching a resumed conversation", async () => {
    const db = admin(new FakeSupabase({ copilot_conversations: [{ id: "chat", organization_id: ORG, user_id: USER, crm_source: "twenty", integration_connection_id: CONNECTION }] }));
    await expect(conversationBinding(db, { orgId: ORG, userId: USER, conversationId: "chat" })).resolves.toEqual({ crmSource: "twenty", connectionId: CONNECTION });
    expect(ownerCheck).toHaveBeenCalledWith(db, ORG, USER);
    await expect(conversationBinding(db, { orgId: ORG, userId: USER, conversationId: "chat", crmSource: "pulse" })).rejects.toThrow("conversation_source_mismatch");
    await expect(conversationBinding(db, { orgId: ORG, userId: USER, conversationId: "chat", connectionId: "other" })).rejects.toThrow("conversation_source_mismatch");
  });
  it("denies another user, tenant, or a demoted owner before reading history", async () => {
    const db = admin(new FakeSupabase({ copilot_conversations: [{ id: "chat", organization_id: ORG, user_id: USER, crm_source: "twenty", integration_connection_id: CONNECTION }] }));
    await expect(conversationBinding(db, { orgId: "other", userId: USER, conversationId: "chat" })).rejects.toThrow("conversation_not_found");
    await expect(conversationBinding(db, { orgId: ORG, userId: "other", conversationId: "chat" })).rejects.toThrow("conversation_not_found");
    ownerCheck.mockRejectedValueOnce(new Error("Owner or admin required"));
    await expect(conversationBinding(db, { orgId: ORG, userId: USER, conversationId: "chat" })).rejects.toThrow("Owner or admin");
  });
  it("reads only this connection's Twenty memory and never Pulse records or ICPs", async () => {
    const memory = (content: string, crm_source: string, connection_id: string | null, organization_id = ORG) => ({ content, crm_source, connection_id, organization_id, type: "custom", source: "copilot", is_active: true });
    const db = new FakeSupabase({ copilot_memory: [memory("Twenty fact", "twenty", CONNECTION), memory("Pulse secret", "pulse", null), memory("Other connection secret", "twenty", "other"), memory("Other tenant secret", "twenty", CONNECTION, "other")], icp_profiles: [{ name: "Pulse ICP secret" }] });
    const result = await loadTwentyMemory(admin(db), ORG, CONNECTION, 1500);
    expect(result.text).toContain("Twenty fact"); expect(result.text).not.toContain("secret");
    expect(db.log.map((row) => row.table)).toEqual(["copilot_memory"]);
  });
});
