// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SequenceSettingsSchema } from "@/lib/security/sequence-settings";

// Mirrors the payload built in app/dashboard/sequences/[id]/client.tsx handleSaveSettings.
const CLIENT_PAYLOAD = {
  schedule_days: ["mon", "tue", "wed", "thu", "fri"],
  start_hour: 9,
  end_hour: 17,
  daily_send_limit: 50,
  max_new_leads_per_day: 20,
  email_account_ids: ["3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b"],
  stop_on_reply: true,
  stop_on_bounce: true,
  stop_on_unsubscribe: true,
  timezone: "America/New_York",
};

describe("SequenceSettingsSchema", () => {
  it("accepts the exact ten-key payload the settings form sends", () => {
    const parsed = SequenceSettingsSchema.safeParse(CLIENT_PAYLOAD);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(CLIENT_PAYLOAD);
  });

  it("rejects an unknown key", () => {
    expect(SequenceSettingsSchema.safeParse({ ...CLIENT_PAYLOAD, is_admin: true }).success).toBe(false);
  });

  it("rejects a non-uuid email account id", () => {
    expect(
      SequenceSettingsSchema.safeParse({ ...CLIENT_PAYLOAD, email_account_ids: ["not-a-uuid"] }).success,
    ).toBe(false);
  });

  it("rejects start_hour 24", () => {
    expect(SequenceSettingsSchema.safeParse({ ...CLIENT_PAYLOAD, start_hour: 24 }).success).toBe(false);
  });

  it("accepts an empty object", () => {
    expect(SequenceSettingsSchema.safeParse({}).success).toBe(true);
  });
});
