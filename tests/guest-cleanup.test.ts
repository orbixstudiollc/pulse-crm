// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  GUEST_CLEANUP_BATCH,
  GUEST_CLEANUP_MAX_PAGES,
  guestRetentionDays,
  purgeExpiredGuests,
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

type Call = [method: string, ...args: unknown[]];
type Page = { data: GuestProfileRow[] | null; error: { message: string } | null };

// Chainable stand-in for a PostgREST query: records every call and resolves
// to whatever `resolve` returns for the recorded calls when awaited.
function fakeQuery(table: string, resolve: (calls: Call[]) => unknown) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = { table, calls };
  for (const method of ["select", "like", "lt", "gt", "eq", "neq", "order", "limit", "delete"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(resolve(calls)).then(onFulfilled, onRejected);
  return builder as { table: string; calls: Call[] };
}

function isCountQuery(calls: Call[]): boolean {
  return calls.some((c) => c[0] === "select" && (c[2] as { head?: boolean } | undefined)?.head === true);
}

function fakeAdmin(opts: { scanPage: (index: number) => Page; anonymousIds?: Set<string> }) {
  const profileQueries: { calls: Call[] }[] = [];
  const scanQueries = () => profileQueries.filter((q) => !isCountQuery(q.calls));
  const admin = {
    from(table: string) {
      const query = fakeQuery(table, (calls) => {
        if (table === "organizations") return { error: null };
        if (isCountQuery(calls)) return { count: 0, error: null };
        return opts.scanPage(scanQueries().indexOf(query));
      });
      if (table === "profiles") profileQueries.push(query);
      return query;
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: { id, is_anonymous: opts.anonymousIds?.has(id) ?? false } },
          error: null,
        }),
        deleteUser: async () => ({ error: null }),
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient<Database>, scanQueries };
}

function guestPage(prefix: string, length: number): GuestProfileRow[] {
  return Array.from({ length }, (_, i) =>
    row(`${prefix}-${String(i).padStart(4, "0")}`, `${prefix}${i}@guest.local`, 10),
  );
}

describe("purgeExpiredGuests", () => {
  it("pages past a full batch of skipped rows to reach an older guest", async () => {
    const first = guestPage("a", GUEST_CLEANUP_BATCH);
    const guest = row("b-0000", "b@guest.local", 10);
    const { admin, scanQueries } = fakeAdmin({
      scanPage: (i) => ({ data: i === 0 ? first : [guest], error: null }),
      anonymousIds: new Set([guest.id]),
    });

    const result = await purgeExpiredGuests(admin, NOW);

    expect(result).toEqual({
      scanned: GUEST_CLEANUP_BATCH + 1,
      skipped: GUEST_CLEANUP_BATCH,
      deletedUsers: 1,
      deletedOrgs: 1,
      errors: [],
    });
    const scans = scanQueries();
    expect(scans).toHaveLength(2);
    expect(scans[0].calls.some((c) => c[0] === "gt")).toBe(false);
    expect(scans[0].calls).toContainEqual(["order", "id", { ascending: true }]);
    expect(scans[1].calls).toContainEqual(["gt", "id", first[GUEST_CLEANUP_BATCH - 1].id]);
  });

  it("stops after GUEST_CLEANUP_MAX_PAGES full pages", async () => {
    const { admin, scanQueries } = fakeAdmin({
      scanPage: (i) => ({ data: guestPage(`p${i}`, GUEST_CLEANUP_BATCH), error: null }),
    });

    const result = await purgeExpiredGuests(admin, NOW);

    expect(result.scanned).toBe(GUEST_CLEANUP_BATCH * GUEST_CLEANUP_MAX_PAGES);
    expect(result.skipped).toBe(GUEST_CLEANUP_BATCH * GUEST_CLEANUP_MAX_PAGES);
    expect(scanQueries()).toHaveLength(GUEST_CLEANUP_MAX_PAGES);
  });

  it("reports a scan error and stops", async () => {
    const { admin } = fakeAdmin({ scanPage: () => ({ data: null, error: { message: "boom" } }) });

    const result = await purgeExpiredGuests(admin, NOW);

    expect(result.errors).toEqual(["scan: boom"]);
    expect(result.scanned).toBe(0);
  });
});
