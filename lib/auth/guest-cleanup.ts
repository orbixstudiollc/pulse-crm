import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { GUEST_EMAIL_DOMAIN, isGuestEmail } from "@/lib/auth/open-access";

// Purges throwaway open-access guests (anonymous auth users with an
// @guest.local profile email) and their single-member workspaces once they
// are older than the retention window. Called from the daily cron.

export const GUEST_RETENTION_DAYS_DEFAULT = 7;
export const GUEST_CLEANUP_BATCH = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

export function guestRetentionDays(env: string | undefined = process.env.GUEST_RETENTION_DAYS): number {
  const days = /^\d+$/.test(env ?? "") ? Number(env) : 0;
  return days > 0 ? days : GUEST_RETENTION_DAYS_DEFAULT;
}

export interface GuestProfileRow {
  id: string;
  email: string | null;
  organization_id: string | null;
  created_at: string;
}

export function selectExpiredGuests(rows: GuestProfileRow[], now: Date, retentionDays: number): GuestProfileRow[] {
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  return rows
    .filter((row) => isGuestEmail(row.email) && new Date(row.created_at).getTime() < cutoff)
    .slice(0, GUEST_CLEANUP_BATCH);
}

export async function purgeExpiredGuests(
  admin: SupabaseClient<Database>,
  now = new Date(),
): Promise<{ scanned: number; deletedUsers: number; deletedOrgs: number; skipped: number; errors: string[] }> {
  const result = { scanned: 0, deletedUsers: 0, deletedOrgs: 0, skipped: 0, errors: [] as string[] };
  const retentionDays = guestRetentionDays();
  const cutoffIso = new Date(now.getTime() - retentionDays * DAY_MS).toISOString();

  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, email, organization_id, created_at")
    .like("email", `%@${GUEST_EMAIL_DOMAIN}`)
    .lt("created_at", cutoffIso)
    .limit(GUEST_CLEANUP_BATCH);
  if (error) {
    result.errors.push(`scan: ${error.message}`);
    return result;
  }

  const expired = selectExpiredGuests(rows ?? [], now, retentionDays);
  result.scanned = expired.length;

  for (const row of expired) {
    try {
      const { data, error: userError } = await admin.auth.admin.getUserById(row.id);
      if (userError) {
        result.errors.push(`${row.id}: ${userError.message}`);
        continue;
      }
      const isAnonymous = data.user?.is_anonymous === true;
      if (!isAnonymous) {
        result.skipped++;
        continue;
      }

      if (row.organization_id) {
        const { count, error: countError } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", row.organization_id)
          .neq("id", row.id);
        if (countError) {
          result.errors.push(`${row.id}: ${countError.message}`);
          continue;
        }
        if ((count ?? 0) > 0) {
          result.skipped++;
          continue;
        }

        // FK cascades remove the workspace data; profiles.organization_id -> NULL.
        const { error: orgError } = await admin.from("organizations").delete().eq("id", row.organization_id);
        if (orgError) {
          result.errors.push(`${row.id}: ${orgError.message}`);
          continue;
        }
        result.deletedOrgs++;
      }

      // Cascades the profile row.
      const { error: deleteError } = await admin.auth.admin.deleteUser(row.id);
      if (deleteError) {
        result.errors.push(`${row.id}: ${deleteError.message}`);
        continue;
      }
      result.deletedUsers++;
    } catch (err) {
      result.errors.push(`${row.id}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return result;
}
