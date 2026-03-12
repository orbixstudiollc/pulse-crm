import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { NextResponse } from "next/server";

const MEETING_KEYWORDS = [
  "meeting", "call", "schedule", "calendar", "book", "slot",
  "available", "availability", "time", "chat", "discuss",
  "demo", "let's talk", "hop on", "set up", "catch up",
  "15 min", "30 min", "calendly", "cal.com",
];

function detectMeetingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return MEETING_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Webhook: Inbound Reply Detection
 * Called by email provider (e.g., SendGrid, Postmark) when a reply is received.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { messageId, inReplyTo, from, subject, textBody, htmlBody } = body;

  if (!messageId && !inReplyTo) {
    return NextResponse.json({ error: "Missing messageId or inReplyTo" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find original message by provider_message_id or id
  const lookupId = inReplyTo || messageId;
  const { data: originalMessage } = await supabase
    .from("email_messages")
    .select("id, thread_id, enrollment_id, organization_id, email_account_id")
    .or(`id.eq.${lookupId},provider_message_id.eq.${lookupId}`)
    .limit(1)
    .maybeSingle();

  if (!originalMessage) {
    return NextResponse.json({ success: true, matched: false });
  }

  // Record reply event
  await recordTrackingEvent(originalMessage.id, "opened", { reply: true });

  // Get lead_id from thread
  let leadId: string | null = null;
  if (originalMessage.thread_id) {
    const { data: thread } = await supabase
      .from("email_threads")
      .select("lead_id")
      .eq("id", originalMessage.thread_id)
      .single();
    leadId = thread?.lead_id ?? null;
  }

  // Store reply as inbound message
  if (originalMessage.thread_id) {
    await supabase.from("email_messages").insert({
      organization_id: originalMessage.organization_id,
      email_account_id: originalMessage.email_account_id,
      thread_id: originalMessage.thread_id,
      direction: "inbound" as const,
      from_address: from || "",
      to_addresses: [] as string[],
      subject: subject || "",
      body_html: htmlBody || "",
      body_text: textBody || "",
      status: "sent" as const,
      sent_at: new Date().toISOString(),
    });
  }

  // Record sequence event for reply
  if (originalMessage.enrollment_id) {
    await supabase.from("sequence_events").insert({
      enrollment_id: originalMessage.enrollment_id,
      event_type: "email_replied",
      event_data: { from, subject },
    });

    // Update enrollment reply status
    await supabase
      .from("sequence_enrollments")
      .update({ status: "replied" })
      .eq("id", originalMessage.enrollment_id);
  }

  // Fire automation trigger
  if (leadId) {
    const replyText = textBody || htmlBody || "";
    const hasMeetingIntent = detectMeetingIntent(replyText);

    import("@/lib/actions/automation").then(({ evaluateLeadAgainstRules }) =>
      evaluateLeadAgainstRules(leadId!, "email_replied", {
        message_id: originalMessage.id,
        has_meeting_intent: hasMeetingIntent,
      }).catch(() => {}),
    );

    // Auto-log meeting interest as activity
    if (hasMeetingIntent) {
      const { data: lead } = await supabase
        .from("leads")
        .select("organization_id")
        .eq("id", leadId)
        .single();

      if (lead) {
        await supabase.from("lead_activities").insert({
          lead_id: leadId,
          organization_id: lead.organization_id,
          type: "note",
          title: "Meeting interest detected",
          description: `Reply indicates scheduling intent. Subject: "${subject || "Re: ..."}"`,
          status: "completed",
        });
      }
    }
  }

  return NextResponse.json({ success: true, matched: true, leadId });
}
