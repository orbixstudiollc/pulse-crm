import { createAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

// ── Tracking Pixel ─────────────────────────────────────────────────────────

export function injectTrackingPixel(html: string, messageId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://pulse-crm-rosy.vercel.app");

  const pixelUrl = `${baseUrl}/api/email/track/open/${messageId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

// ── Link Wrapping ──────────────────────────────────────────────────────────

export async function wrapLinksForTracking(
  html: string,
  messageId: string,
): Promise<{ html: string; links: { id: string; original_url: string }[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://pulse-crm-rosy.vercel.app");

  const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
  const links: { id: string; original_url: string }[] = [];

  const wrappedHtml = html.replace(linkRegex, (match, before, url, after) => {
    if (url.startsWith("mailto:") || url.includes("unsubscribe")) {
      return match;
    }
    const linkId = randomUUID();
    links.push({ id: linkId, original_url: url });
    const trackUrl = `${baseUrl}/api/email/track/click/${linkId}`;
    return `<a ${before}href="${trackUrl}"${after}>`;
  });

  if (links.length > 0) {
    const supabase = createAdminClient();
    await supabase.from("email_link_tracking").insert(
      links.map((l) => ({
        id: l.id,
        message_id: messageId,
        original_url: l.original_url,
        tracking_url: `${baseUrl}/api/email/track/click/${l.id}`,
      })),
    );
  }

  return { html: wrappedHtml, links };
}

// ── Record Tracking Event ──────────────────────────────────────────────────

export async function recordTrackingEvent(
  messageId: string,
  eventType: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complaint" | "unsubscribed",
  metadata?: Record<string, unknown>,
) {
  const supabase = createAdminClient();

  // Insert tracking event
  await supabase.from("email_tracking_events").insert({
    message_id: messageId,
    event_type: eventType,
    ...(metadata ? { metadata: metadata as Record<string, never> } : {}),
  });

  // Update message counters
  if (eventType === "opened") {
    const { data: msg } = await supabase
      .from("email_messages")
      .select("open_count")
      .eq("id", messageId)
      .single();
    if (msg) {
      await supabase
        .from("email_messages")
        .update({
          open_count: msg.open_count + 1,
          ...(msg.open_count === 0 ? { first_opened_at: new Date().toISOString() } : {}),
          last_opened_at: new Date().toISOString(),
        })
        .eq("id", messageId);
    }
  } else if (eventType === "clicked") {
    const { data: msg } = await supabase
      .from("email_messages")
      .select("click_count")
      .eq("id", messageId)
      .single();
    if (msg) {
      await supabase
        .from("email_messages")
        .update({ click_count: msg.click_count + 1 })
        .eq("id", messageId);
    }
  }

  // Update message status (only upgrade, never downgrade)
  const statusOrder = ["draft", "queued", "sending", "sent", "delivered", "opened", "clicked", "replied"];
  const statusMap: Record<string, string> = {
    sent: "sent", delivered: "delivered", opened: "opened", clicked: "clicked", bounced: "bounced",
  };
  const newStatus = statusMap[eventType];
  if (newStatus) {
    const { data: current } = await supabase
      .from("email_messages")
      .select("status")
      .eq("id", messageId)
      .single();
    if (current) {
      const currentIdx = statusOrder.indexOf(current.status);
      const newIdx = statusOrder.indexOf(newStatus);
      if (newIdx > currentIdx || newStatus === "bounced") {
        type MsgStatus = "sent" | "delivered" | "opened" | "clicked" | "bounced";
        await supabase
          .from("email_messages")
          .update({ status: newStatus as MsgStatus })
          .eq("id", messageId);
      }
    }
  }

  // Fire automation triggers for email events
  if (["opened", "clicked", "bounced"].includes(eventType)) {
    // Get lead_id from message → thread
    const { data: msg } = await supabase
      .from("email_messages")
      .select("thread_id")
      .eq("id", messageId)
      .single();

    if (msg?.thread_id) {
      const { data: thread } = await supabase
        .from("email_threads")
        .select("lead_id")
        .eq("id", msg.thread_id)
        .single();

      if (thread?.lead_id) {
        const triggerMap: Record<string, string> = {
          opened: "email_opened",
          clicked: "email_clicked",
          bounced: "email_bounced",
        };
        const triggerType = triggerMap[eventType] as import("@/lib/automation/engine").TriggerType | undefined;
        if (triggerType) {
          import("@/lib/actions/automation").then(({ evaluateLeadAgainstRules }) =>
            evaluateLeadAgainstRules(thread.lead_id!, triggerType, {
              message_id: messageId,
            }).catch(() => {}),
          );
        }
      }
    }
  }
}
