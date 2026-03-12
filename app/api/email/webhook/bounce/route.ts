import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { messageId, type, reason, email } = body;

  if (!messageId || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (type === "bounce") {
    await recordTrackingEvent(messageId, "bounced", { reason, email });

    // Update message status
    await supabase
      .from("email_messages")
      .update({ status: "bounced" })
      .eq("id", messageId);
  } else if (type === "complaint") {
    await recordTrackingEvent(messageId, "complaint", { reason, email });
  }

  return NextResponse.json({ success: true });
}
