import { createAdminClient } from "@/lib/supabase/server";
import { resetDailyCounters, resetWeeklyCounters } from "@/lib/linkedin/rate-limiter";
import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/security";
import { purgeExpiredGuests } from "@/lib/auth/guest-cleanup";
import { expireApprovals } from "@/lib/ai/approvals";
import { runDueTasks, type RunDueTasksResult } from "@/lib/ai/tasks/run-due-tasks";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Scheduled tasks must stop starting new runs 200 s in, leaving room for the guest purge. */
const TASKS_BUDGET_MS = 200_000;
const APPROVAL_EXPIRY_HOURS = 72;

export async function GET(request: Request) {
  const authErr = verifyCronRequest(request);
  if (authErr) return authErr;

  const startedAt = Date.now();
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

  // 6. Drop shared-AI budget counters older than 8 UTC days (migration 038);
  // a failure is reported but does not stop the rest of the cron.
  let sharedAiBudgetPurged: number | null = null;
  try {
    const { data, error } = await supabase.rpc("purge_shared_ai_budget", { p_keep_days: 8 });
    if (error) throw new Error(error.message);
    sharedAiBudgetPurged = data;
    results.shared_ai_budget_purge = "ok";
  } catch (err) {
    results.shared_ai_budget_purge = err instanceof Error ? err.message : "error";
  }

  // 7. Expire Copilot approvals left pending for 72 hours
  let approvalsExpired: number | null = null;
  try {
    approvalsExpired = await expireApprovals(supabase, APPROVAL_EXPIRY_HOURS);
    results.approvals_expire = "ok";
  } catch (err) {
    results.approvals_expire = err instanceof Error ? err.message : "error";
  }

  // 8. Run due scheduled Copilot tasks, before the guest purge so a guest
  // workspace's task still runs on its last day; no run starts after the deadline.
  let tasks: RunDueTasksResult | null = null;
  try {
    tasks = await runDueTasks({ admin: supabase, now: new Date(startedAt), deadlineAt: startedAt + TASKS_BUDGET_MS });
    results.tasks = "ok";
    console.log(
      `[daily-reset] tasks: attempted=${tasks.attempted} done=${tasks.done} skipped=${tasks.skipped} failed=${tasks.failed} deferred=${tasks.deferred}`
    );
  } catch (err) {
    results.tasks = err instanceof Error ? err.message : "error";
  }

  // 9. Purge expired anonymous guest workspaces (runs even when open access is
  // off, so leftovers are cleaned up after the mode is switched off)
  const purge = await purgeExpiredGuests(supabase);
  results.guest_cleanup = purge.errors.length ? purge.errors.join("; ") : "ok";
  console.log(
    `[daily-reset] guest cleanup: scanned=${purge.scanned} deletedUsers=${purge.deletedUsers} deletedOrgs=${purge.deletedOrgs} skipped=${purge.skipped} errors=${purge.errors.length}`
  );

  const hasErrors = Object.values(results).some(v => v !== "ok");

  return NextResponse.json(
    { success: !hasErrors, results, sharedAiBudgetPurged, approvalsExpired, tasks, timestamp: new Date().toISOString() },
    { status: hasErrors ? 207 : 200 }
  );
}
