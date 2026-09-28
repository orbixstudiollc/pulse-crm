import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isUuid, verifyWebhookHeader } from "@/lib/security";

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

const replyBodySchema = z.object({
  messageId: z.string().min(1).max(998).optional(),
  inReplyTo: z.string().min(1).max(998).optional(),
  from: z.string().max(998).optional(),
  subject: z.string().max(998).optional(),
  textBody: z.string().max(500_000).optional(),
  htmlBody: z.string().max(500_000).optional(),
});

/**
 * Webhook: Inbound Reply Detection
 * Called by email provider (e.g., SendGrid, Postmark) when a reply is received.
 */
export async function POST(request: Request) {
  const authErr = verifyWebhookHeader(
    request,
    "x-webhook-secret",
    "EMAIL_WEBHOOK_SECRET"
  );
  if (authErr) return authErr;

  let body: z.infer<typeof replyBodySchema>;
  try {
    body = replyBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { messageId, inReplyTo, from, subject, textBody, htmlBody } = body;

  if (!messageId && !inReplyTo) {
    return NextResponse.json(
      { error: "Missing messageId or inReplyTo" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // SECURITY: only do exact lookups on validated identifiers. Never interpolate
  // user input into a PostgREST `.or()` filter.
  const lookupId = inReplyTo || messageId || "";
  let originalMessage: {
    id: string;
    thread_id: string | null;
    enrollment_id: string | null;
    organization_id: string;
    email_account_id: string;
  } | null = null;

  if (isUuid(lookupId)) {
    const { data } = await supabase
      .from("email_messages")
      .select(
        "id, thread_id, enrollment_id, organization_id, email_account_id"
      )
      .eq("id", lookupId)
      .maybeSingle();
    originalMessage = data ?? null;
  }

  if (!originalMessage) {
    const { data } = await supabase
      .from("email_messages")
      .select(
        "id, thread_id, enrollment_id, organization_id, email_account_id"
      )
      .eq("provider_message_id", lookupId)
      .maybeSingle();
    originalMessage = data ?? null;
  }

  if (!originalMessage) {
    return NextResponse.json({ success: true, matched: false });
  }

  await recordTrackingEvent(originalMessage.id, "opened", { reply: true });

  let leadId: string | null = null;
  if (originalMessage.thread_id) {
    const { data: thread } = await supabase
      .from("email_threads")
      .select("lead_id")
      .eq("id", originalMessage.thread_id)
      .single();
    leadId = thread?.lead_id ?? null;
  }

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

  if (originalMessage.enrollment_id) {
    await supabase.from("sequence_events").insert({
      enrollment_id: originalMessage.enrollment_id,
      event_type: "email_replied",
      event_data: { from, subject },
    });

    await supabase
      .from("sequence_enrollments")
      .update({ status: "replied" })
      .eq("id", originalMessage.enrollment_id);
  }

  if (leadId) {
    const replyText = textBody || htmlBody || "";
    const hasMeetingIntent = detectMeetingIntent(replyText);

    import("@/lib/actions/automation").then(({ evaluateLeadAgainstRules }) =>
      evaluateLeadAgainstRules(leadId!, "email_replied", {
        message_id: originalMessage.id,
        has_meeting_intent: hasMeetingIntent,
      }).catch(() => {}),
    );

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
