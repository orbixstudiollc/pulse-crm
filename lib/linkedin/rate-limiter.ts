/**
 * LinkedIn Rate Limiter
 * Enforces daily/weekly limits to prevent LinkedIn account bans.
 * LinkedIn is aggressive with rate limiting — these defaults are conservative.
 */

"use server";

import { createAdminClient } from "@/lib/supabase/server";

export type LinkedInActionType =
  | "connect"
  | "message"
  | "inmail"
  | "view_profile"
  | "endorse";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  error?: string;
}

// ============================================================
// Check if Action is Allowed
// ============================================================

export async function canPerformAction(
  accountId: string,
  actionType: LinkedInActionType
): Promise<RateLimitResult> {
  const supabase = createAdminClient();

  const { data: account, error } = await supabase
    .from("linkedin_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return { allowed: false, remaining: 0, limit: 0, error: "Account not found" };
  }

  if (account.status !== "active") {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      error: `Account is ${account.status}`,
    };
  }

  switch (actionType) {
    case "connect":
      // Check both daily AND weekly limits
      if (account.daily_connection_requests >= account.daily_connection_limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: account.daily_connection_limit,
          error: "Daily connection limit reached",
        };
      }
      if (account.weekly_connection_requests >= account.weekly_connection_limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: account.weekly_connection_limit,
          error: "Weekly connection limit reached",
        };
      }
      return {
        allowed: true,
        remaining: Math.min(
          account.daily_connection_limit - account.daily_connection_requests,
          account.weekly_connection_limit - account.weekly_connection_requests
        ),
        limit: account.daily_connection_limit,
      };

    case "message":
    case "inmail":
      if (account.daily_messages_sent >= account.daily_message_limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: account.daily_message_limit,
          error: "Daily message limit reached",
        };
      }
      return {
        allowed: true,
        remaining: account.daily_message_limit - account.daily_messages_sent,
        limit: account.daily_message_limit,
      };

    case "view_profile":
      if (account.daily_profile_views >= account.daily_profile_view_limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: account.daily_profile_view_limit,
          error: "Daily profile view limit reached",
        };
      }
      return {
        allowed: true,
        remaining: account.daily_profile_view_limit - account.daily_profile_views,
        limit: account.daily_profile_view_limit,
      };

    case "endorse":
      if (account.daily_endorsements >= account.daily_endorsement_limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: account.daily_endorsement_limit,
          error: "Daily endorsement limit reached",
        };
      }
      return {
        allowed: true,
        remaining: account.daily_endorsement_limit - account.daily_endorsements,
        limit: account.daily_endorsement_limit,
      };

    default:
      return { allowed: false, remaining: 0, limit: 0, error: "Unknown action type" };
  }
}

// ============================================================
// Increment Counter After Successful Action
// ============================================================

export async function incrementCounter(
  accountId: string,
  actionType: LinkedInActionType
) {
  const supabase = createAdminClient();

  const { data: account } = await supabase
    .from("linkedin_accounts")
    .select(
      "daily_connection_requests, daily_messages_sent, weekly_connection_requests, daily_profile_views, daily_endorsements"
    )
    .eq("id", accountId)
    .single();

  if (!account) return;

  const update: Record<string, number> = {};

  switch (actionType) {
    case "connect":
      update.daily_connection_requests = account.daily_connection_requests + 1;
      update.weekly_connection_requests = account.weekly_connection_requests + 1;
      break;
    case "message":
    case "inmail":
      update.daily_messages_sent = account.daily_messages_sent + 1;
      break;
    case "view_profile":
      update.daily_profile_views = account.daily_profile_views + 1;
      break;
    case "endorse":
      update.daily_endorsements = account.daily_endorsements + 1;
      break;
  }

  await supabase
    .from("linkedin_accounts")
    .update(update)
    .eq("id", accountId);
}

// ============================================================
// Reset Daily Counters (called by cron)
// ============================================================

export async function resetDailyCounters() {
  const supabase = createAdminClient();

  await supabase
    .from("linkedin_accounts")
    .update({
      daily_connection_requests: 0,
      daily_messages_sent: 0,
      daily_profile_views: 0,
      daily_endorsements: 0,
    })
    .neq("status", "disconnected");
}

// ============================================================
// Reset Weekly Counters (called by cron on Mondays)
// ============================================================

export async function resetWeeklyCounters() {
  const supabase = createAdminClient();

  await supabase
    .from("linkedin_accounts")
    .update({
      weekly_connection_requests: 0,
    })
    .neq("status", "disconnected");
}

// ============================================================
// Add Random Delay (2-5 minutes between LinkedIn actions)
// ============================================================

export function getRandomDelay(): number {
  // Returns delay in milliseconds: 2-5 minutes
  return Math.floor(Math.random() * (5 - 2 + 1) + 2) * 60 * 1000;
}
