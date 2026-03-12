import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/sender";
import { injectTrackingPixel, wrapLinksForTracking, recordTrackingEvent } from "@/lib/email/tracking";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

interface SequenceSettings {
  schedule_days?: boolean[];
  schedule_start_hour?: number;
  schedule_end_hour?: number;
  daily_send_limit?: number;
  max_new_leads_per_day?: number;
  email_account_ids?: string[];
  stop_on_reply?: boolean;
  stop_on_bounce?: boolean;
  stop_on_unsubscribe?: boolean;
  timezone?: string;
}

interface StepVariant {
  id: string;
  subject: string;
  body: string;
  weight: number;
  sent?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
}

function isWithinSchedule(settings: SequenceSettings): boolean {
  const tz = settings.timezone || "UTC";
  let nowInTz: Date;
  try {
    const formatted = new Date().toLocaleString("en-US", { timeZone: tz });
    nowInTz = new Date(formatted);
  } catch {
    nowInTz = new Date();
  }

  // Check day of week (0=Sun, 1=Mon ... 6=Sat)
  const days = settings.schedule_days;
  if (days && Array.isArray(days) && days.length === 7) {
    const dayIndex = nowInTz.getDay();
    if (!days[dayIndex]) return false;
  }

  // Check hour range
  const hour = nowInTz.getHours();
  const startHour = settings.schedule_start_hour ?? 0;
  const endHour = settings.schedule_end_hour ?? 23;
  if (hour < startHour || hour > endHour) return false;

  return true;
}

function pickVariant(variants: StepVariant[]): StepVariant | null {
  if (!variants || variants.length === 0) return null;
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0);
  let random = Math.random() * totalWeight;
  for (const v of variants) {
    random -= v.weight || 1;
    if (random <= 0) return v;
  }
  return variants[0];
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  // 1. Process scheduled emails (queued messages past their scheduled_at)
  const { data: scheduledMsgs } = await supabase
    .from("email_messages")
    .select("id, email_account_id, to_addresses, subject, body_html, body_text")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .limit(50);

  if (scheduledMsgs) {
    for (const msg of scheduledMsgs) {
      try {
        await supabase
          .from("email_messages")
          .update({ status: "sending" as const })
          .eq("id", msg.id);

        let html = msg.body_html;
        html = injectTrackingPixel(html, msg.id);
        const tracked = await wrapLinksForTracking(html, msg.id);
        html = tracked.html;

        const result = await sendEmail({
          accountId: msg.email_account_id,
          to: msg.to_addresses.join(", "),
          subject: msg.subject,
          html,
          text: msg.body_text || undefined,
        });

        if (result.success) {
          await supabase
            .from("email_messages")
            .update({
              status: "sent" as const,
              provider_message_id: result.messageId,
              sent_at: new Date().toISOString(),
            })
            .eq("id", msg.id);
          await recordTrackingEvent(msg.id, "sent");
          processed++;
        } else {
          await supabase
            .from("email_messages")
            .update({ status: "failed" as const, error_message: result.error })
            .eq("id", msg.id);
          errors++;
        }
      } catch (err) {
        await supabase
          .from("email_messages")
          .update({
            status: "failed" as const,
            error_message: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", msg.id);
        errors++;
      }
    }
  }

  // 2. Process active sequence enrollments
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select(`
      id,
      sequence_id,
      lead_id,
      current_step,
      status,
      updated_at,
      sequences!inner (
        id,
        organization_id,
        settings,
        steps:sequence_steps (
          id,
          step_order,
          step_type,
          delay_days,
          subject,
          body,
          variants
        )
      )
    `)
    .eq("status", "active")
    .limit(50);

  // Track sends per sequence for daily limit enforcement
  const sendCountBySequence = new Map<string, number>();
  // Track account rotation index per sequence
  const accountRotationIndex = new Map<string, number>();

  if (enrollments) {
    for (const enrollment of enrollments) {
      try {
        const sequence = enrollment.sequences as unknown as {
          id: string;
          organization_id: string;
          settings: SequenceSettings | null;
          steps: Array<{
            id: string;
            step_order: number;
            step_type: string;
            delay_days: number;
            subject: string | null;
            body: string | null;
            variants: StepVariant[] | null;
          }>;
        };

        const settings: SequenceSettings = (sequence.settings as SequenceSettings) || {};

        // --- Check schedule ---
        if (!isWithinSchedule(settings)) {
          skipped++;
          continue;
        }

        // --- Check daily send limit ---
        const dailyLimit = settings.daily_send_limit;
        if (dailyLimit && dailyLimit > 0) {
          const currentCount = sendCountBySequence.get(sequence.id) || 0;
          if (currentCount >= dailyLimit) {
            skipped++;
            continue;
          }
        }

        // --- Check stop conditions ---
        if (settings.stop_on_reply) {
          const { count } = await supabase
            .from("sequence_events")
            .select("id", { count: "exact", head: true })
            .eq("enrollment_id", enrollment.id)
            .eq("event_type", "email_replied");
          if (count && count > 0) {
            await supabase
              .from("sequence_enrollments")
              .update({ status: "completed" as const, completed_at: new Date().toISOString() })
              .eq("id", enrollment.id);
            skipped++;
            continue;
          }
        }

        if (settings.stop_on_bounce) {
          const { count } = await supabase
            .from("sequence_events")
            .select("id", { count: "exact", head: true })
            .eq("enrollment_id", enrollment.id)
            .eq("event_type", "email_bounced");
          if (count && count > 0) {
            await supabase
              .from("sequence_enrollments")
              .update({ status: "completed" as const, completed_at: new Date().toISOString() })
              .eq("id", enrollment.id);
            skipped++;
            continue;
          }
        }

        if (settings.stop_on_unsubscribe) {
          const { count } = await supabase
            .from("sequence_events")
            .select("id", { count: "exact", head: true })
            .eq("enrollment_id", enrollment.id)
            .eq("event_type", "unsubscribed");
          if (count && count > 0) {
            await supabase
              .from("sequence_enrollments")
              .update({ status: "completed" as const, completed_at: new Date().toISOString() })
              .eq("id", enrollment.id);
            skipped++;
            continue;
          }
        }

        // Find the current step
        const currentStep = sequence.steps?.find(
          (s) => s.step_order === enrollment.current_step,
        );

        if (!currentStep || currentStep.step_type !== "email") {
          continue;
        }

        // --- A/B Variant selection ---
        let stepSubject = currentStep.subject;
        let stepBody = currentStep.body;
        let selectedVariantId: string | null = null;

        const variants = currentStep.variants as StepVariant[] | null;
        if (variants && variants.length > 0) {
          const picked = pickVariant(variants);
          if (picked && picked.subject && picked.body) {
            stepSubject = picked.subject;
            stepBody = picked.body;
            selectedVariantId = picked.id;
          }
        }

        if (!stepSubject || !stepBody) continue;

        // Check if enough time has passed based on delay_days
        const delayMs = currentStep.delay_days * 24 * 60 * 60 * 1000;
        const readyAt = new Date(new Date(enrollment.updated_at).getTime() + delayMs);
        if (readyAt > new Date(now)) {
          continue;
        }

        // --- Account selection: rotation or default ---
        let accountId: string | null = null;
        const configuredAccounts = settings.email_account_ids;

        if (configuredAccounts && configuredAccounts.length > 0) {
          // Rotate through configured accounts
          const rotIdx = accountRotationIndex.get(sequence.id) || 0;
          const selectedAccountId = configuredAccounts[rotIdx % configuredAccounts.length];
          accountRotationIndex.set(sequence.id, rotIdx + 1);

          // Verify account is still active
          const { data: acct } = await supabase
            .from("email_accounts")
            .select("id")
            .eq("id", selectedAccountId)
            .eq("status", "active")
            .single();

          if (acct) {
            accountId = acct.id;
          }
        }

        // Fallback to default org account
        if (!accountId) {
          const { data: account } = await supabase
            .from("email_accounts")
            .select("id")
            .eq("organization_id", sequence.organization_id)
            .eq("status", "active")
            .eq("is_default", true)
            .single();

          if (!account) continue;
          accountId = account.id;
        }

        // Get lead info
        const { data: lead } = await supabase
          .from("leads")
          .select("email, name, company")
          .eq("id", enrollment.lead_id)
          .single();

        if (!lead?.email) continue;

        // Render template with full personalization engine
        let subject = stepSubject;
        let html = stepBody;

        try {
          const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
          [subject, html] = await Promise.all([
            resolveMergeFields(subject, enrollment.lead_id, accountId),
            resolveMergeFields(html, enrollment.lead_id, accountId),
          ]);
        } catch {
          // Fallback to basic merge if personalization engine fails
          const mergeFields: Record<string, string> = {
            "{{name}}": lead.name || "",
            "{{company}}": lead.company || "",
            "{{email}}": lead.email,
          };
          for (const [key, value] of Object.entries(mergeFields)) {
            subject = subject.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "gi"), value);
            html = html.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "gi"), value);
          }
        }

        // Create thread + message + send
        const { data: thread } = await supabase
          .from("email_threads")
          .insert({
            organization_id: sequence.organization_id,
            email_account_id: accountId,
            subject,
            lead_id: enrollment.lead_id,
            enrollment_id: enrollment.id,
          })
          .select("id")
          .single();

        if (!thread) continue;

        const { data: message } = await supabase
          .from("email_messages")
          .insert({
            organization_id: sequence.organization_id,
            thread_id: thread.id,
            email_account_id: accountId,
            direction: "outbound" as const,
            from_address: "",
            to_addresses: [lead.email],
            subject,
            body_html: html,
            body_text: "",
            status: "sending" as const,
            enrollment_id: enrollment.id,
            step_id: currentStep.id,
          })
          .select("id")
          .single();

        if (!message) continue;

        // Auto-insert booking CTA if step has include_booking_cta enabled
        if ((currentStep as Record<string, unknown>).include_booking_cta) {
          const bookingCtaHtml = `<div style="margin:24px 0;text-align:center"><a href="{{booking_link}}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Book a Call &rarr;</a></div>`;
          // Resolve booking_link
          try {
            const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
            const resolvedCta = await resolveMergeFields(bookingCtaHtml, enrollment.lead_id, accountId);
            html = html + resolvedCta;
          } catch {
            // Skip CTA if merge fails
          }
        }

        // Apply tracking
        let trackedHtml = injectTrackingPixel(html, message.id);
        const linkResult = await wrapLinksForTracking(trackedHtml, message.id);
        trackedHtml = linkResult.html;

        // Send
        const sendResult = await sendEmail({
          accountId,
          to: lead.email,
          subject,
          html: trackedHtml,
        });

        if (sendResult.success) {
          // Get account email for from_address
          const { data: acctData } = await supabase
            .from("email_accounts")
            .select("email_address")
            .eq("id", accountId)
            .single();

          await supabase
            .from("email_messages")
            .update({
              status: "sent" as const,
              provider_message_id: sendResult.messageId,
              from_address: acctData?.email_address || "",
              sent_at: new Date().toISOString(),
            })
            .eq("id", message.id);

          await recordTrackingEvent(message.id, "sent");

          // Record sequence event (include variant info if applicable)
          await supabase.from("sequence_events").insert({
            enrollment_id: enrollment.id,
            step_id: currentStep.id,
            event_type: "email_sent",
            metadata: {
              message_id: message.id,
              ...(selectedVariantId ? { variant_id: selectedVariantId } : {}),
            },
          });

          // Increment variant sent counter if A/B variant was used
          if (selectedVariantId && variants) {
            const updatedVariants = variants.map((v) =>
              v.id === selectedVariantId ? { ...v, sent: (v.sent || 0) + 1 } : v,
            );
            await supabase
              .from("sequence_steps")
              .update({ variants: JSON.parse(JSON.stringify(updatedVariants)) })
              .eq("id", currentStep.id);
          }

          // Track daily send count
          sendCountBySequence.set(
            sequence.id,
            (sendCountBySequence.get(sequence.id) || 0) + 1,
          );

          // Advance to next step
          const nextStep = sequence.steps?.find(
            (s) => s.step_order === enrollment.current_step + 1,
          );

          if (nextStep) {
            await supabase
              .from("sequence_enrollments")
              .update({
                current_step: enrollment.current_step + 1,
              })
              .eq("id", enrollment.id);
          } else {
            await supabase
              .from("sequence_enrollments")
              .update({
                status: "completed" as const,
                completed_at: new Date().toISOString(),
              })
              .eq("id", enrollment.id);
          }

          processed++;
        } else {
          await supabase
            .from("email_messages")
            .update({ status: "failed" as const, error_message: sendResult.error })
            .eq("id", message.id);
          errors++;
        }
      } catch (err) {
        console.error(`Enrollment ${enrollment.id} failed:`, err);
        errors++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    errors,
    skipped,
    timestamp: now,
  });
}
