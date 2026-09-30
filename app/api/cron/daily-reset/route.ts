import { createAdminClient } from "@/lib/supabase/server";
import { resetDailyCounters, resetWeeklyCounters } from "@/lib/linkedin/rate-limiter";
import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security";
import { purgeExpiredGuests } from "@/lib/auth/guest-cleanup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authErr = verifyCronRequest(request);
  if (authErr) return authErr;

  const supabase = createAdminClient();
  const results: Record<string, string> = {};

  // 1. Reset email daily sent counts
  const { error: emailError } = await supabase
    .from("email_accounts")
    .update({ daily_sent_count: 0 })
    .neq("daily_sent_count", 0);

  results.email = emailError ? emailError.message : "ok";

  // 2. Reset WhatsApp daily sent counts
  const { error: waError } = await supabase
    .from("whatsapp_accounts")
    .update({ daily_sent_count: 0 })
    .neq("daily_sent_count", 0);

  results.whatsapp = waError ? waError.message : "ok";

  // 3. Reset LinkedIn daily counters
  try {
    await resetDailyCounters();
    results.linkedin_daily = "ok";
  } catch (err) {
    results.linkedin_daily = err instanceof Error ? err.message : "error";
  }

  // 4. Reset LinkedIn weekly counters on Mondays
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon
  if (dayOfWeek === 1) {
    try {
      await resetWeeklyCounters();
      results.linkedin_weekly = "ok";
    } catch (err) {
      results.linkedin_weekly = err instanceof Error ? err.message : "error";
    }
  }

  // 5. Re-activate rate-limited LinkedIn accounts
  const { error: reactivateError } = await supabase
    .from("linkedin_accounts")
    .update({ status: "active" as const, last_error: null })
    .eq("status", "rate_limited");

  results.linkedin_reactivate = reactivateError ? reactivateError.message : "ok";

  // 6. Purge expired anonymous guest workspaces (runs even when open access is
  // off, so leftovers are cleaned up after the mode is switched off)
  const purge = await purgeExpiredGuests(supabase);
  results.guest_cleanup = purge.errors.length ? purge.errors.join("; ") : "ok";
  console.log(
    `[daily-reset] guest cleanup: scanned=${purge.scanned} deletedUsers=${purge.deletedUsers} deletedOrgs=${purge.deletedOrgs} skipped=${purge.skipped} errors=${purge.errors.length}`
  );

  const hasErrors = Object.values(results).some(v => v !== "ok");

  return NextResponse.json(
    { success: !hasErrors, results, timestamp: new Date().toISOString() },
    { status: hasErrors ? 207 : 200 }
  );
}
