"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { sendEmail } from "@/lib/email/sender";
import { injectTrackingPixel, wrapLinksForTracking, recordTrackingEvent } from "@/lib/email/tracking";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

interface ComposeEmailOptions {
  accountId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  // Thread linkage
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  // CRM linkage
  leadId?: string;
  contactId?: string;
  customerId?: string;
  // Sequence linkage
  enrollmentId?: string;
  stepId?: string;
  // Options
  trackOpens?: boolean;
  trackClicks?: boolean;
  scheduledAt?: string;
}

// ── Send Email ─────────────────────────────────────────────────────────────

export async function composeAndSendEmail(opts: ComposeEmailOptions) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Create or get thread
  let threadId = opts.threadId;
  if (!threadId) {
    const { data: thread } = await supabase
      .from("email_threads")
      .insert({
        organization_id: orgId,
        email_account_id: opts.accountId,
        subject: opts.subject,
        lead_id: opts.leadId || null,
        contact_id: opts.contactId || null,
        customer_id: opts.customerId || null,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!thread) {
      return { error: "Failed to create email thread" };
    }
    threadId = thread.id;
  }

  // Create message record (status: sending)
  const { data: message, error: msgError } = await supabase
    .from("email_messages")
    .insert({
      organization_id: orgId,
      thread_id: threadId,
      email_account_id: opts.accountId,
      direction: "outbound" as const,
      from_address: "",
      to_addresses: opts.to.split(",").map((e) => e.trim()),
      cc_addresses: opts.cc ? opts.cc.split(",").map((e) => e.trim()) : [],
      bcc_addresses: opts.bcc ? opts.bcc.split(",").map((e) => e.trim()) : [],
      subject: opts.subject,
      body_html: opts.html,
      body_text: opts.text || opts.html.replace(/<[^>]*>/g, ""),
      status: opts.scheduledAt ? ("queued" as const) : ("sending" as const),
      scheduled_at: opts.scheduledAt || null,
      enrollment_id: opts.enrollmentId || null,
      step_id: opts.stepId || null,
    })
    .select("id")
    .single();

  if (msgError || !message) {
    return { error: msgError?.message || "Failed to create message record" };
  }

  // If scheduled, don't send now
  if (opts.scheduledAt) {
    return { data: { messageId: message.id, status: "queued" } };
  }

  // Apply tracking
  let finalHtml = opts.html;
  if (opts.trackOpens !== false) {
    finalHtml = injectTrackingPixel(finalHtml, message.id);
  }
  if (opts.trackClicks !== false) {
    const result = await wrapLinksForTracking(finalHtml, message.id);
    finalHtml = result.html;
  }

  // Send
  const sendResult = await sendEmail({
    accountId: opts.accountId,
    to: opts.to,
    subject: opts.subject,
    html: finalHtml,
    text: opts.text,
    cc: opts.cc,
    bcc: opts.bcc,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
  });

  if (!sendResult.success) {
    await supabase
      .from("email_messages")
      .update({ status: "failed" as const })
      .eq("id", message.id);
    return { error: sendResult.error };
  }

  // Update message with provider message ID and from address
  const { data: account } = await supabase
    .from("email_accounts")
    .select("email_address")
    .eq("id", opts.accountId)
    .single();

  await supabase
    .from("email_messages")
    .update({
      status: "sent" as const,
      provider_message_id: sendResult.messageId,
      from_address: account?.email_address || "",
      sent_at: new Date().toISOString(),
    })
    .eq("id", message.id);

  // Update thread last_message_at
  await supabase
    .from("email_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  // Record tracking event
  await recordTrackingEvent(message.id, "sent");

  revalidatePath("/dashboard/inbox");
  return { data: { messageId: message.id, status: "sent" } };
}

// ── Send Reply ─────────────────────────────────────────────────────────────

export async function sendReply(opts: {
  threadId: string;
  accountId: string;
  to: string;
  html: string;
  text?: string;
  cc?: string;
  inReplyTo?: string;
  references?: string;
}) {
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("email_threads")
    .select("subject")
    .eq("id", opts.threadId)
    .single();

  const subject = thread ? `Re: ${thread.subject}` : "Re:";

  return composeAndSendEmail({
    accountId: opts.accountId,
    to: opts.to,
    subject,
    html: opts.html,
    text: opts.text,
    cc: opts.cc,
    threadId: opts.threadId,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
  });
}

// ── Save Draft ─────────────────────────────────────────────────────────────

export async function saveDraft(opts: {
  accountId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  threadId?: string;
  leadId?: string;
  contactId?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Create thread for the draft if none provided
  let threadId = opts.threadId;
  if (!threadId) {
    const { data: thread } = await supabase
      .from("email_threads")
      .insert({
        organization_id: orgId,
        email_account_id: opts.accountId,
        subject: opts.subject,
        lead_id: opts.leadId || null,
        contact_id: opts.contactId || null,
      })
      .select("id")
      .single();

    if (!thread) return { error: "Failed to create thread" };
    threadId = thread.id;
  }

  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      organization_id: orgId,
      thread_id: threadId,
      email_account_id: opts.accountId,
      direction: "outbound" as const,
      from_address: "",
      to_addresses: opts.to ? opts.to.split(",").map((e) => e.trim()) : [],
      subject: opts.subject,
      body_html: opts.html,
      body_text: opts.text || "",
      status: "draft" as const,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { data };
}
