import { describe, expect, it } from "vitest";
import { selectActiveTools, wantsWriteTools } from "@/lib/ai/tools/select";

const allTools = ["search_leads", "get_lead", "save_memory", "draft_email", "update_lead", "set_followup", "create_deal"];
const writeTools = ["update_lead", "set_followup", "create_deal"];
const base = { allTools, writeTools, messageText: null, answeringApprovals: false, lastAssistantText: null, historyToolNames: [] };

describe("selectActiveTools", () => {
  it("leaves record-changing tools out of a read-only question", () => {
    const names = selectActiveTools({ ...base, messageText: "Show my 3 newest leads." });
    expect(names).toEqual(["search_leads", "get_lead", "save_memory", "draft_email"]);
  });

  it("offers every tool when the message asks for a change", () => {
    for (const text of [
      "Set follow-ups for next Tuesday on my hot leads",
      "Move the Acme deal to negotiation",
      "Create a deal for Globex",
      "mark Sarah as warm",
      "Add a note to this lead",
    ]) {
      expect(selectActiveTools({ ...base, messageText: text }), text).toEqual(allTools);
    }
  });

  it("offers every tool when answering approval cards", () => {
    expect(selectActiveTools({ ...base, answeringApprovals: true })).toEqual(allTools);
  });

  it("offers every tool when the user accepts an offer", () => {
    const offer = "Amanda is your best opportunity. Want me to draft outreach or set a follow-up?";
    expect(selectActiveTools({ ...base, messageText: "yes please", lastAssistantText: offer })).toEqual(allTools);
    expect(selectActiveTools({ ...base, messageText: "Go ahead", lastAssistantText: offer })).toEqual(allTools);
  });

  it("does not treat a long or unrelated reply as accepting an offer", () => {
    const offer = "Want me to set follow-ups?";
    expect(wantsWriteTools({ messageText: "ok, but first summarise which of them came from referrals and why", lastAssistantText: offer, answeringApprovals: false })).toBe(false);
    expect(wantsWriteTools({ messageText: "yes", lastAssistantText: "Here are your leads.", answeringApprovals: false })).toBe(false);
  });

  it("keeps write tools already used in the visible history", () => {
    const names = selectActiveTools({ ...base, messageText: "Which leads did that affect?", historyToolNames: ["set_followup", "search_leads"] });
    expect(names).toContain("set_followup");
    expect(names).not.toContain("update_lead");
    expect(names).not.toContain("create_deal");
  });
});
