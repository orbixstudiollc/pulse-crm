/**
 * WhatsApp High-Level Sender
 * Mirrors the email sender pattern — handles account lookup, daily limits,
 * dispatches via the WhatsApp Cloud API client, increments counters, and
 * records the message in the whatsapp_messages table.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  sendTemplateMessage,
  sendTextMessage,
  sendMediaMessage,
  type WhatsAppMediaMessage,
} from "./client";
import type { Json } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface SendWhatsAppOptions {
  organizationId: string;
  accountId?: string; // specific account, or fallback to default
  leadId?: string;
  enrollmentId?: string;
  stepId?: string;
  to: string; // recipient phone number in E.164 format
  messageType: "text" | "template" | "image" | "document" | "video" | "audio";
  // For template messages
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Json;
  // For text messages
  bodyText?: string;
  // For media messages
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
}

interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  waMessageId?: string;
  error?: string;
}

// ============================================================
// Main Send Function
// ============================================================

export async function sendWhatsApp(
  options: SendWhatsAppOptions
): Promise<SendWhatsAppResult> {
  const supabase = createAdminClient();

  // 1. Get WhatsApp account
  let accountQuery = supabase
    .from("whatsapp_accounts")
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
    return {
      success: false,
      error: "No active WhatsApp account found",
    };
  }

  // 2. Check daily send limit
  if (account.daily_sent_count >= account.daily_send_limit) {
    return {
      success: false,
      error: `Daily send limit reached (${account.daily_send_limit})`,
    };
  }

  // 3. Insert queued message record
  const { data: msgRecord, error: insertError } = await supabase
    .from("whatsapp_messages")
    .insert({
      organization_id: options.organizationId,
      whatsapp_account_id: account.id,
      lead_id: options.leadId || null,
      enrollment_id: options.enrollmentId || null,
      step_id: options.stepId || null,
      direction: "outbound",
      message_type: options.messageType,
      template_id: options.templateId || null,
      template_params: options.templateParams || null,
      body_text: options.bodyText || null,
      media_url: options.mediaUrl || null,
      media_mime_type: options.mediaMimeType || null,
      media_caption: options.mediaCaption || null,
      status: "queued",
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !msgRecord) {
    return {
      success: false,
      error: "Failed to create message record",
    };
  }

  // 4. Send via WhatsApp Cloud API
  let result;

  switch (options.messageType) {
    case "template": {
      if (!options.templateName || !options.templateLanguage) {
        await updateMessageStatus(supabase, msgRecord.id, "failed", "MISSING_TEMPLATE", "Template name and language required");
        return { success: false, error: "Template name and language required" };
      }

      const components = options.templateParams
        ? (options.templateParams as Array<{ type: string; parameters: Array<{ type: string; text?: string }> }>)
        : undefined;

      result = await sendTemplateMessage(
        account.phone_number_id,
        account.access_token_encrypted,
        options.to,
        options.templateName,
        options.templateLanguage,
        components
      );
      break;
    }

    case "text": {
      if (!options.bodyText) {
        await updateMessageStatus(supabase, msgRecord.id, "failed", "MISSING_TEXT", "Body text required");
        return { success: false, error: "Body text required" };
      }

      result = await sendTextMessage(
        account.phone_number_id,
        account.access_token_encrypted,
        options.to,
        options.bodyText
      );
      break;
    }

    case "image":
    case "document":
    case "video":
    case "audio": {
      if (!options.mediaUrl) {
        await updateMessageStatus(supabase, msgRecord.id, "failed", "MISSING_MEDIA", "Media URL required");
        return { success: false, error: "Media URL required" };
      }

      const media: WhatsAppMediaMessage = {
        type: options.messageType,
        url: options.mediaUrl,
        caption: options.mediaCaption,
        mimeType: options.mediaMimeType,
      };

      result = await sendMediaMessage(
        account.phone_number_id,
        account.access_token_encrypted,
        options.to,
        media
      );
      break;
    }

    default:
      await updateMessageStatus(supabase, msgRecord.id, "failed", "UNSUPPORTED_TYPE", `Unsupported message type: ${options.messageType}`);
      return { success: false, error: `Unsupported message type: ${options.messageType}` };
  }

  // 5. Update message record with result
  if (result.success) {
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        wa_message_id: result.messageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", msgRecord.id);

    // Increment daily counter
    await supabase
      .from("whatsapp_accounts")
      .update({ daily_sent_count: account.daily_sent_count + 1 })
      .eq("id", account.id);

    return {
      success: true,
      messageId: msgRecord.id,
      waMessageId: result.messageId,
    };
  } else {
    await updateMessageStatus(
      supabase,
      msgRecord.id,
      "failed",
      result.error?.code || "UNKNOWN",
      result.error?.message || "Unknown error"
    );

    // Update account error
    await supabase
      .from("whatsapp_accounts")
      .update({ last_error: result.error?.message })
      .eq("id", account.id);

    return {
      success: false,
      messageId: msgRecord.id,
      error: result.error?.message,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateMessageStatus(
  supabase: ReturnType<typeof createAdminClient>,
  messageId: string,
  status: string,
  errorCode: string,
  errorMessage: string
) {
  await supabase
    .from("whatsapp_messages")
    .update({
      status,
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", messageId);
}
