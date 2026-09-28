import { createClient } from "@/lib/supabase/server";
import { composeAndSendEmail } from "@/lib/actions/email-send";
import { NextResponse } from "next/server";
import { z } from "zod";

const sendSchema = z.object({
  accountId: z.string().uuid(),
  to: z.string().min(1).max(2000),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(500_000),
  text: z.string().max(500_000).optional(),
  cc: z.string().max(2000).optional(),
  bcc: z.string().max(2000).optional(),
  threadId: z.string().uuid().optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.string().max(4000).optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  enrollmentId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof sendSchema>;
  try {
    parsed = sendSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await composeAndSendEmail(parsed);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
