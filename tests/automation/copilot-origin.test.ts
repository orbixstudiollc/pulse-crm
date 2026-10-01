// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../helpers/fake-supabase";

vi.mock("server-only", () => ({}));

class FakeAdmin extends FakeSupabase {
  rpc() {
    return Promise.resolve({ data: null, error: null });
  }
}

let db: FakeAdmin;
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db }));

import { evaluateLeadAgainstRules, executeAutomationActions } from "@/lib/automation/runner";
import type { AutomationAction } from "@/lib/automation/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const ORG = "11111111-1111-4111-8111-111111111111";
const LEAD = "44444444-4444-4444-8444-444444444444";
const SEQ = "77777777-7777-4777-8777-777777777777";

function seed() {
  return new FakeAdmin({
    leads: [{ id: LEAD, organization_id: ORG, name: "Jane Doe", status: "hot", tags: [] }],
    sequences: [{ id: SEQ, organization_id: ORG, status: "active", created_at: "2026-01-01T00:00:00Z" }],
    sequence_enrollments: [],
    automation_rules: [
      {
        id: "rule-1",
        organization_id: ORG,
        is_active: true,
        trigger_type: "lead_created",
        trigger_config: {},
        conditions: [],
        actions: [
          { type: "enroll_sequence", config: { sequence_id: SEQ } },
          { type: "add_tag", config: { tag: "vip" } },
        ],
        execution_order: 1,
      },
    ],
    automation_executions: [],
  });
}

const lead = () => db.tables.leads[0];

describe("copilot-origin automation runs", () => {
  beforeEach(() => {
    db = seed();
  });

  it("with origin 'copilot' skips enroll_sequence (no sequence_enrollments insert) while add_tag runs", async () => {
    const outcome = await evaluateLeadAgainstRules(LEAD, "lead_created", {}, { origin: "copilot" });

    expect(outcome).toEqual({ skipped: ["enroll_sequence"] });
    expect(db.tables.sequence_enrollments).toHaveLength(0);
    expect(db.log.some((e) => e.table === "sequence_enrollments" && e.op === "insert")).toBe(false);
    expect(lead().tags).toEqual(["vip"]);
    expect(db.tables.automation_executions[0].actions_executed).toEqual([
      { type: "enroll_sequence", success: false, error: "skipped_for_copilot" },
      { type: "add_tag", success: true },
    ]);
  });

  it("without origin, enroll_sequence runs as before", async () => {
    const outcome = await evaluateLeadAgainstRules(LEAD, "lead_created", {});

    expect(outcome).toEqual({ skipped: [] });
    expect(db.tables.sequence_enrollments).toHaveLength(1);
    expect(db.tables.sequence_enrollments[0]).toMatchObject({ sequence_id: SEQ, lead_id: LEAD, status: "active" });
    expect(lead().tags).toEqual(["vip"]);
  });

  it("copilot origin runs only the allowlist: an unknown future action type is skipped too", async () => {
    const actions = [
      { type: "send_email", config: {} },
      { type: "change_status", config: { status: "warm" } },
    ] as unknown as AutomationAction[];
    const admin = db as unknown as SupabaseClient<Database>;

    const results = await executeAutomationActions(admin, ORG, LEAD, actions, undefined, { origin: "copilot" });

    expect(results).toEqual([
      { type: "send_email", success: false, error: "skipped_for_copilot" },
      { type: "change_status", success: true },
    ]);
    expect(lead().status).toBe("warm");
  });
});
