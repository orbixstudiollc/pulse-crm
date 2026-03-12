import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/sender";
import { injectTrackingPixel, wrapLinksForTracking, recordTrackingEvent } from "@/lib/email/tracking";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { sendLinkedIn } from "@/lib/linkedin/sender";
import { getRandomDelay } from "@/lib/linkedin/rate-limiter";
import { NextResponse } from "next/server";
import type { Json } from "@/types/database";

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
      whatsapp_account_id,
      linkedin_account_id,
      sequences!inner (
        id,
        organization_id,
        settings,
        steps:sequence_steps (
          id,
          step_order,
          step_type,
          channel,
          channel_config,
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
            channel: string | null;
            channel_config: Record<string, unknown> | null;
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

        if (!currentStep) {
          continue;
        }

        // Check if enough time has passed based on delay_days
        const delayMs = currentStep.delay_days * 24 * 60 * 60 * 1000;
        const readyAt = new Date(new Date(enrollment.updated_at).getTime() + delayMs);
        if (readyAt > new Date(now)) {
          continue;
        }

        // Determine channel from step (backwards compat: default to email)
        const channel = currentStep.channel || currentStep.step_type || "email";
        const channelConfig = currentStep.channel_config || {};

        // =============================================
        // Channel Dispatcher
        // =============================================
        let stepResult: { success: boolean; error?: string } = { success: false };

        switch (channel) {
          // ---- EMAIL ----
          case "email": {
            stepResult = await processEmailStep(
              supabase, enrollment, sequence, currentStep, settings,
              accountRotationIndex, sendCountBySequence, now
            );
            break;
          }

          // ---- WHATSAPP ----
          case "whatsapp": {
            // Get lead phone
            const { data: waLead } = await supabase
              .from("leads")
              .select("phone, name, company")
              .eq("id", enrollment.lead_id)
              .single();

            if (!waLead?.phone) {
              skipped++;
              continue;
            }

            // Personalize body text
            let waBody = (channelConfig.body_text as string) || currentStep.body || "";
            try {
              const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
              waBody = await resolveMergeFields(waBody, enrollment.lead_id, undefined);
            } catch {
              const mergeFields: Record<string, string> = {
                "{{name}}": waLead.name || "",
                "{{company}}": waLead.company || "",
              };
              for (const [key, value] of Object.entries(mergeFields)) {
                waBody = waBody.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "gi"), value);
              }
            }

            const waMessageType = (channelConfig.message_type as string) || "text";
            const waResult = await sendWhatsApp({
              organizationId: sequence.organization_id,
              accountId: (enrollment as Record<string, unknown>).whatsapp_account_id as string | undefined,
              leadId: enrollment.lead_id,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              to: waLead.phone,
              messageType: waMessageType as "text" | "template" | "image" | "document" | "video" | "audio",
              templateId: channelConfig.template_id as string | undefined,
              templateName: channelConfig.template_name as string | undefined,
              templateLanguage: channelConfig.template_language as string | undefined,
              templateParams: channelConfig.template_params as Json | undefined,
              bodyText: waBody,
              mediaUrl: channelConfig.media_url as string | undefined,
              mediaMimeType: channelConfig.media_mime_type as string | undefined,
              mediaCaption: channelConfig.media_caption as string | undefined,
            });

            if (waResult.success) {
              await supabase.from("sequence_events").insert({
                enrollment_id: enrollment.id,
                step_id: currentStep.id,
                event_type: "whatsapp_sent",
                metadata: { message_id: waResult.messageId, wa_message_id: waResult.waMessageId },
              });
            }

            stepResult = waResult;
            break;
          }

          // ---- LINKEDIN CONNECT ----
          case "linkedin_connect": {
            const { data: liLead } = await supabase
              .from("leads")
              .select("linkedin, name")
              .eq("id", enrollment.lead_id)
              .single();

            if (!liLead?.linkedin) {
              skipped++;
              continue;
            }

            // Extract LinkedIn ID from URL or use stored value
            const targetLinkedInId = (channelConfig.target_linkedin_id as string) || extractLinkedInId(liLead.linkedin);

            // Personalize connection note
            let connectionNote = (channelConfig.connection_note as string) || "";
            if (connectionNote) {
              try {
                const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
                connectionNote = await resolveMergeFields(connectionNote, enrollment.lead_id, undefined);
              } catch {
                connectionNote = connectionNote
                  .replace(/\{\{name\}\}/gi, liLead.name || "");
              }
              // LinkedIn 300 char limit
              connectionNote = connectionNote.substring(0, 300);
            }

            // Apply random delay to appear human
            const liDelay = getRandomDelay();
            await new Promise(resolve => setTimeout(resolve, Math.min(liDelay, 10000))); // Cap at 10s in cron

            const liConnectResult = await sendLinkedIn({
              organizationId: sequence.organization_id,
              accountId: (enrollment as Record<string, unknown>).linkedin_account_id as string | undefined,
              leadId: enrollment.lead_id,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              actionType: "connect",
              connectionNote,
              targetLinkedInId,
              targetLinkedInUrl: liLead.linkedin,
            });

            stepResult = liConnectResult;
            break;
          }

          // ---- LINKEDIN MESSAGE ----
          case "linkedin_message": {
            const { data: liMsgLead } = await supabase
              .from("leads")
              .select("linkedin, name, company")
              .eq("id", enrollment.lead_id)
              .single();

            if (!liMsgLead?.linkedin) {
              skipped++;
              continue;
            }

            const targetId = (channelConfig.target_linkedin_id as string) || extractLinkedInId(liMsgLead.linkedin);

            // Personalize message
            let msgBody = (channelConfig.message_body as string) || currentStep.body || "";
            try {
              const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
              msgBody = await resolveMergeFields(msgBody, enrollment.lead_id, undefined);
            } catch {
              msgBody = msgBody
                .replace(/\{\{name\}\}/gi, liMsgLead.name || "")
                .replace(/\{\{company\}\}/gi, liMsgLead.company || "");
            }

            const liDelay2 = getRandomDelay();
            await new Promise(resolve => setTimeout(resolve, Math.min(liDelay2, 10000)));

            const liMsgResult = await sendLinkedIn({
              organizationId: sequence.organization_id,
              accountId: (enrollment as Record<string, unknown>).linkedin_account_id as string | undefined,
              leadId: enrollment.lead_id,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              actionType: "message",
              messageBody: msgBody,
              targetLinkedInId: targetId,
              targetLinkedInUrl: liMsgLead.linkedin,
            });

            stepResult = liMsgResult;
            break;
          }

          // ---- LINKEDIN VIEW PROFILE ----
          case "linkedin_view": {
            const { data: liViewLead } = await supabase
              .from("leads")
              .select("linkedin")
              .eq("id", enrollment.lead_id)
              .single();

            if (!liViewLead?.linkedin) {
              skipped++;
              continue;
            }

            const liDelay3 = getRandomDelay();
            await new Promise(resolve => setTimeout(resolve, Math.min(liDelay3, 10000)));

            const liViewResult = await sendLinkedIn({
              organizationId: sequence.organization_id,
              accountId: (enrollment as Record<string, unknown>).linkedin_account_id as string | undefined,
              leadId: enrollment.lead_id,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              actionType: "view_profile",
              targetLinkedInUrl: liViewLead.linkedin,
            });

            stepResult = liViewResult;
            break;
          }

          // ---- LINKEDIN ENDORSE ----
          case "linkedin_endorse": {
            const { data: liEndorseLead } = await supabase
              .from("leads")
              .select("linkedin")
              .eq("id", enrollment.lead_id)
              .single();

            if (!liEndorseLead?.linkedin) {
              skipped++;
              continue;
            }

            const targetEndorseId = (channelConfig.target_linkedin_id as string) || extractLinkedInId(liEndorseLead.linkedin);
            const skillName = (channelConfig.skill_name as string) || "";

            if (!skillName) {
              skipped++;
              continue;
            }

            const liDelay4 = getRandomDelay();
            await new Promise(resolve => setTimeout(resolve, Math.min(liDelay4, 10000)));

            const liEndorseResult = await sendLinkedIn({
              organizationId: sequence.organization_id,
              accountId: (enrollment as Record<string, unknown>).linkedin_account_id as string | undefined,
              leadId: enrollment.lead_id,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              actionType: "endorse",
              targetLinkedInId: targetEndorseId,
              targetLinkedInUrl: liEndorseLead.linkedin,
              skillName,
            });

            stepResult = liEndorseResult;
            break;
          }

          default:
            skipped++;
            continue;
        }

        // =============================================
        // Post-dispatch: Advance enrollment or mark failed
        // =============================================
        if (stepResult.success) {
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
              .update({ current_step: enrollment.current_step + 1 })
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

// ============================================================
// Extract LinkedIn ID from URL
// ============================================================

function extractLinkedInId(url: string): string {
  // https://www.linkedin.com/in/john-doe-123abc/ → john-doe-123abc
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1] : url;
}

// ============================================================
// Process Email Step (extracted from original inline code)
// ============================================================

async function processEmailStep(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: {
    id: string;
    lead_id: string;
    current_step: number;
    updated_at: string;
  },
  sequence: {
    id: string;
    organization_id: string;
    settings: SequenceSettings | null;
  },
  currentStep: {
    id: string;
    step_order: number;
    step_type: string;
    subject: string | null;
    body: string | null;
    variants: StepVariant[] | null;
  },
  settings: SequenceSettings,
  accountRotationIndex: Map<string, number>,
  sendCountBySequence: Map<string, number>,
  now: string,
): Promise<{ success: boolean; error?: string }> {
  // A/B Variant selection
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

  if (!stepSubject || !stepBody) return { success: false, error: "No subject/body" };

  // Account selection: rotation or default
  let accountId: string | null = null;
  const configuredAccounts = settings.email_account_ids;

  if (configuredAccounts && configuredAccounts.length > 0) {
    const rotIdx = accountRotationIndex.get(sequence.id) || 0;
    const selectedAccountId = configuredAccounts[rotIdx % configuredAccounts.length];
    accountRotationIndex.set(sequence.id, rotIdx + 1);

    const { data: acct } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("id", selectedAccountId)
      .eq("status", "active")
      .single();

    if (acct) accountId = acct.id;
  }

  if (!accountId) {
    const { data: account } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("organization_id", sequence.organization_id)
      .eq("status", "active")
      .eq("is_default", true)
      .single();

    if (!account) return { success: false, error: "No email account" };
    accountId = account.id;
  }

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("email, name, company")
    .eq("id", enrollment.lead_id)
    .single();

  if (!lead?.email) return { success: false, error: "No lead email" };

  // Personalize
  let subject = stepSubject;
  let html = stepBody;

  try {
    const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
    [subject, html] = await Promise.all([
      resolveMergeFields(subject, enrollment.lead_id, accountId),
      resolveMergeFields(html, enrollment.lead_id, accountId),
    ]);
  } catch {
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

  // Create thread + message
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

  if (!thread) return { success: false, error: "Failed to create thread" };

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

  if (!message) return { success: false, error: "Failed to create message" };

  // Booking CTA
  if ((currentStep as Record<string, unknown>).include_booking_cta) {
    const bookingCtaHtml = `<div style="margin:24px 0;text-align:center"><a href="{{booking_link}}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Book a Call &rarr;</a></div>`;
    try {
      const { resolveMergeFields } = await import("@/lib/personalization/merge-engine");
      const resolvedCta = await resolveMergeFields(bookingCtaHtml, enrollment.lead_id, accountId);
      html = html + resolvedCta;
    } catch { /* skip */ }
  }

  // Tracking
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

    await supabase.from("sequence_events").insert({
      enrollment_id: enrollment.id,
      step_id: currentStep.id,
      event_type: "email_sent",
      metadata: {
        message_id: message.id,
        ...(selectedVariantId ? { variant_id: selectedVariantId } : {}),
      },
    });

    if (selectedVariantId && variants) {
      const updatedVariants = variants.map((v) =>
        v.id === selectedVariantId ? { ...v, sent: (v.sent || 0) + 1 } : v,
      );
      await supabase
        .from("sequence_steps")
        .update({ variants: JSON.parse(JSON.stringify(updatedVariants)) })
        .eq("id", currentStep.id);
    }

    sendCountBySequence.set(
      sequence.id,
      (sendCountBySequence.get(sequence.id) || 0) + 1,
    );

    return { success: true };
  } else {
    await supabase
      .from("email_messages")
      .update({ status: "failed" as const, error_message: sendResult.error })
      .eq("id", message.id);
    return { success: false, error: sendResult.error };
  }
}
