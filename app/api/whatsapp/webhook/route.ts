/**
 * WhatsApp Webhook Handler
 *
 * GET  → Meta webhook verification challenge
 * POST → Delivery status updates + inbound messages
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/whatsapp/client";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";

// ============================================================
// GET: Webhook Verification (Meta Challenge)
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ============================================================
// POST: Webhook Events (Status Updates + Inbound Messages)
// ============================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify signature if app secret is configured
  if (WHATSAPP_APP_SECRET) {
    const signature = request.headers.get("x-hub-signature-256") || "";
    const isValid = await verifyWebhookSignature(
      rawBody,
      signature,
      WHATSAPP_APP_SECRET
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);
  const supabase = createAdminClient();

  try {
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;

        // Handle status updates (sent, delivered, read, failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(supabase, status);
          }
        }

        // Handle inbound messages
        if (value.messages) {
          const metadata = value.metadata;
          for (const message of value.messages) {
            await handleInboundMessage(
              supabase,
              message,
              metadata?.phone_number_id
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ success: true }); // Always return 200 to Meta
  }
}

// ============================================================
// Handle Status Update
// ============================================================

interface StatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string }>;
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  status: StatusUpdate
) {
  const waMessageId = status.id;

  // Find the message by wa_message_id
  const { data: message } = await supabase
    .from("whatsapp_messages")
    .select("id, enrollment_id, step_id")
    .eq("wa_message_id", waMessageId)
    .single();

  if (!message) return;

  // Build update payload
  const update: Record<string, unknown> = {
    status: status.status,
  };

  const timestamp = new Date(
    parseInt(status.timestamp) * 1000
  ).toISOString();

  switch (status.status) {
    case "sent":
      update.sent_at = timestamp;
      break;
    case "delivered":
      update.delivered_at = timestamp;
      break;
    case "read":
      update.read_at = timestamp;
      break;
    case "failed":
      if (status.errors?.[0]) {
        update.error_code = status.errors[0].code.toString();
        update.error_message = status.errors[0].title;
      }
      break;
  }

  await supabase
    .from("whatsapp_messages")
    .update(update)
    .eq("id", message.id);

  // Record sequence event if linked to enrollment
  if (message.enrollment_id) {
    const eventType =
      status.status === "delivered"
        ? "whatsapp_delivered"
        : status.status === "read"
        ? "whatsapp_read"
        : status.status === "failed"
        ? "whatsapp_failed"
        : null;

    if (eventType) {
      await supabase.from("sequence_events").insert({
        enrollment_id: message.enrollment_id,
        step_id: message.step_id,
        event_type: eventType,
        metadata: { wa_message_id: waMessageId, timestamp },
      });
    }
  }
}

// ============================================================
// Handle Inbound Message
// ============================================================

interface InboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type: string };
  document?: { id: string; caption?: string; filename: string; mime_type: string };
  video?: { id: string; caption?: string; mime_type: string };
  audio?: { id: string; mime_type: string };
}

async function handleInboundMessage(
  supabase: ReturnType<typeof createAdminClient>,
  message: InboundMessage,
  phoneNumberId?: string
) {
  // Deduplicate by wa_message_id
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", message.id)
    .single();

  if (existing) return; // Already processed

  // Find the WhatsApp account by phone_number_id
  const { data: account } = phoneNumberId
    ? await supabase
        .from("whatsapp_accounts")
        .select("id, organization_id")
        .eq("phone_number_id", phoneNumberId)
        .single()
    : { data: null };

  if (!account) return;

  // Try to find the lead by phone number
  const senderPhone = message.from;
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", account.organization_id)
    .eq("phone", senderPhone)
    .single();

  // Determine body text
  let bodyText: string | null = null;
  let mediaCaption: string | null = null;

  if (message.type === "text" && message.text) {
    bodyText = message.text.body;
  } else if (message.image) {
    mediaCaption = message.image.caption || null;
  } else if (message.document) {
    mediaCaption = message.document.caption || null;
  }

  // Find active enrollment for this lead (if any) for reply tracking
  let enrollmentId: string | null = null;
  if (lead) {
    const { data: enrollment } = await supabase
      .from("sequence_enrollments")
      .select("id, current_step")
      .eq("lead_id", lead.id)
      .eq("status", "active")
      .eq("whatsapp_account_id", account.id)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .single();

    if (enrollment) {
      enrollmentId = enrollment.id;
    }
  }

  // Record inbound message
  await supabase.from("whatsapp_messages").insert({
    organization_id: account.organization_id,
    whatsapp_account_id: account.id,
    lead_id: lead?.id || null,
    enrollment_id: enrollmentId,
    direction: "inbound",
    message_type: message.type,
    wa_message_id: message.id,
    body_text: bodyText,
    media_caption: mediaCaption,
    status: "delivered",
    delivered_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    metadata: {},
  });

  // Record sequence event: whatsapp_replied
  if (enrollmentId) {
    await supabase.from("sequence_events").insert({
      enrollment_id: enrollmentId,
      event_type: "whatsapp_replied",
      metadata: {
        wa_message_id: message.id,
        from: senderPhone,
        message_type: message.type,
        body: bodyText,
      },
    });

    // Update enrollment status to replied
    await supabase
      .from("sequence_enrollments")
      .update({ status: "replied" })
      .eq("id", enrollmentId);
  }
}
