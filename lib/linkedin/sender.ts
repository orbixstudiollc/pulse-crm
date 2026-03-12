/**
 * LinkedIn High-Level Sender
 * Handles account lookup, rate limit checks, dispatches via LinkedIn API,
 * increments counters, and records actions in linkedin_actions table.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  sendConnectionRequest,
  sendMessage,
  viewProfile,
  endorseSkill,
} from "./client";
import {
  canPerformAction,
  incrementCounter,
  type LinkedInActionType,
} from "./rate-limiter";

// ============================================================
// Types
// ============================================================

interface SendLinkedInOptions {
  organizationId: string;
  accountId?: string;
  leadId?: string;
  enrollmentId?: string;
  stepId?: string;
  actionType: LinkedInActionType;
  // For connect
  connectionNote?: string;
  // For message
  messageBody?: string;
  // For profile view / endorse
  targetLinkedInUrl?: string;
  targetLinkedInId?: string;
  // For endorse
  skillName?: string;
}

interface SendLinkedInResult {
  success: boolean;
  actionId?: string;
  error?: string;
}

// ============================================================
// Main Send Function
// ============================================================

export async function sendLinkedIn(
  options: SendLinkedInOptions
): Promise<SendLinkedInResult> {
  const supabase = createAdminClient();

  // 1. Get LinkedIn account
  let accountQuery = supabase
    .from("linkedin_accounts")
    .select("*")
    .eq("organization_id", options.organizationId)
    .eq("status", "active");

  if (options.accountId) {
    accountQuery = accountQuery.eq("id", options.accountId);
  } else {
    accountQuery = accountQuery.eq("is_default", true);
  }

  const { data: account, error: accountError } = await accountQuery.single();

  if (accountError || !account) {
    return { success: false, error: "No active LinkedIn account found" };
  }

  // 2. Check rate limits
  const rateLimit = await canPerformAction(account.id, options.actionType);
  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.error };
  }

  // 3. Insert queued action record
  const { data: actionRecord, error: insertError } = await supabase
    .from("linkedin_actions")
    .insert({
      organization_id: options.organizationId,
      linkedin_account_id: account.id,
      lead_id: options.leadId || null,
      enrollment_id: options.enrollmentId || null,
      step_id: options.stepId || null,
      action_type: options.actionType,
      status: "queued",
      connection_note: options.connectionNote || null,
      message_body: options.messageBody || null,
      target_linkedin_url: options.targetLinkedInUrl || null,
      target_linkedin_id: options.targetLinkedInId || null,
      skill_name: options.skillName || null,
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !actionRecord) {
    return { success: false, error: "Failed to create action record" };
  }

  // 4. Execute the action
  let result;

  switch (options.actionType) {
    case "connect": {
      if (!options.targetLinkedInId) {
        await updateActionStatus(supabase, actionRecord.id, "failed", "Target LinkedIn ID required");
        return { success: false, error: "Target LinkedIn ID required" };
      }

      result = await sendConnectionRequest(
        account.access_token_encrypted,
        options.targetLinkedInId,
        options.connectionNote
      );
      break;
    }

    case "message":
    case "inmail": {
      if (!options.targetLinkedInId || !options.messageBody) {
        await updateActionStatus(supabase, actionRecord.id, "failed", "Target LinkedIn ID and message body required");
        return { success: false, error: "Target LinkedIn ID and message body required" };
      }

      result = await sendMessage(
        account.access_token_encrypted,
        account.linkedin_id || "",
        options.targetLinkedInId,
        options.messageBody
      );
      break;
    }

    case "view_profile": {
      if (!options.targetLinkedInUrl) {
        await updateActionStatus(supabase, actionRecord.id, "failed", "Target LinkedIn URL required");
        return { success: false, error: "Target LinkedIn URL required" };
      }

      result = await viewProfile(
        account.access_token_encrypted,
        options.targetLinkedInUrl
      );
      break;
    }

    case "endorse": {
      if (!options.targetLinkedInId || !options.skillName) {
        await updateActionStatus(supabase, actionRecord.id, "failed", "Target LinkedIn ID and skill name required");
        return { success: false, error: "Target LinkedIn ID and skill name required" };
      }

      result = await endorseSkill(
        account.access_token_encrypted,
        options.targetLinkedInId,
        options.skillName
      );
      break;
    }

    default:
      await updateActionStatus(supabase, actionRecord.id, "failed", `Unsupported action: ${options.actionType}`);
      return { success: false, error: `Unsupported action: ${options.actionType}` };
  }

  // 5. Update action record and counters
  if (result.success) {
    await supabase
      .from("linkedin_actions")
      .update({
        status: options.actionType === "connect" ? "pending" : "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", actionRecord.id);

    // Increment rate limit counter
    await incrementCounter(account.id, options.actionType);

    // Record sequence event
    if (options.enrollmentId) {
      const eventType =
        options.actionType === "connect"
          ? "linkedin_connect_sent"
          : options.actionType === "message"
          ? "linkedin_message_sent"
          : options.actionType === "view_profile"
          ? "linkedin_profile_viewed"
          : options.actionType === "endorse"
          ? "linkedin_endorsed"
          : "linkedin_action";

      await supabase.from("sequence_events").insert({
        enrollment_id: options.enrollmentId,
        step_id: options.stepId,
        event_type: eventType,
        metadata: { action_id: actionRecord.id, action_type: options.actionType },
      });
    }

    return { success: true, actionId: actionRecord.id };
  } else {
    await updateActionStatus(
      supabase,
      actionRecord.id,
      "failed",
      result.error?.message || "Unknown error"
    );

    // Update account error
    await supabase
      .from("linkedin_accounts")
      .update({ last_error: result.error?.message })
      .eq("id", account.id);

    // If rate limited by LinkedIn, mark account
    if (result.error?.code === "429") {
      await supabase
        .from("linkedin_accounts")
        .update({ status: "rate_limited" })
        .eq("id", account.id);
    }

    return {
      success: false,
      actionId: actionRecord.id,
      error: result.error?.message,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

async function updateActionStatus(
  supabase: ReturnType<typeof createAdminClient>,
  actionId: string,
  status: string,
  errorMessage: string
) {
  await supabase
    .from("linkedin_actions")
    .update({ status, error_message: errorMessage })
    .eq("id", actionId);
}
