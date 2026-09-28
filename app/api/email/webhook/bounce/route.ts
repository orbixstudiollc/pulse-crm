import { createAdminClient } from "@/lib/supabase/server";
import { recordTrackingEvent } from "@/lib/email/tracking";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isUuid, verifyWebhookHeader } from "@/lib/security";

const bounceSchema = z.object({
  messageId: z.string().min(1).max(256),
  type: z.enum(["bounce", "complaint"]),
  reason: z.string().max(1000).optional(),
  email: z.string().max(320).optional(),
});

export async function POST(request: Request) {
  const authErr = verifyWebhookHeader(
    request,
    "x-webhook-secret",
    "EMAIL_WEBHOOK_SECRET"
  );
  if (authErr) return authErr;

  let body: z.infer<typeof bounceSchema>;
  try {
    body = bounceSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { messageId, type, reason, email } = body;

  if (!isUuid(messageId)) {
    return NextResponse.json(
      { error: "messageId must be a UUID" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (type === "bounce") {
    await recordTrackingEvent(messageId, "bounced", { reason, email });

    await supabase
      .from("email_messages")
      .update({ status: "bounced" })
      .eq("id", messageId);
  } else if (type === "complaint") {
    await recordTrackingEvent(messageId, "complaint", { reason, email });
  }

  return NextResponse.json({ success: true });
}
