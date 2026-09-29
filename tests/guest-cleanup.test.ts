// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GUEST_CLEANUP_BATCH,
  guestRetentionDays,
  selectExpiredGuests,
  type GuestProfileRow,
} from "@/lib/auth/guest-cleanup";

const NOW = new Date("2026-09-29T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function row(id: string, email: string | null, ageDays: number): GuestProfileRow {
  return {
    id,
    email,
    organization_id: `org-${id}`,
    created_at: new Date(NOW.getTime() - ageDays * DAY_MS).toISOString(),
  };
}

describe("selectExpiredGuests", () => {
  it("keeps only guest emails older than the retention window", () => {
    const rows = [
      row("old-guest", "a@guest.local", 8),
      row("new-guest", "b@guest.local", 6),
      row("real", "someone@example.com", 30),
      row("no-email", null, 30),
    ];
    expect(selectExpiredGuests(rows, NOW, 7).map((r) => r.id)).toEqual(["old-guest"]);
  });

  it("caps the result at GUEST_CLEANUP_BATCH", () => {
    const rows = Array.from({ length: GUEST_CLEANUP_BATCH + 50 }, (_, i) => row(`g${i}`, `g${i}@guest.local`, 10));
    expect(selectExpiredGuests(rows, NOW, 7)).toHaveLength(200);
  });
});

describe("guestRetentionDays", () => {
  it("accepts a positive integer and falls back to 7 otherwise", () => {
    expect(guestRetentionDays("3")).toBe(3);
    expect(guestRetentionDays("abc")).toBe(7);
    expect(guestRetentionDays(undefined)).toBe(7);
  });
});
