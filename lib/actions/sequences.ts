"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type SequenceInsert = Database["public"]["Tables"]["sequences"]["Insert"];
type SequenceUpdate = Database["public"]["Tables"]["sequences"]["Update"];
type StepInsert = Database["public"]["Tables"]["sequence_steps"]["Insert"];
type StepUpdate = Database["public"]["Tables"]["sequence_steps"]["Update"];
type EnrollmentInsert = Database["public"]["Tables"]["sequence_enrollments"]["Insert"];

// ── Sequence CRUD ───────────────────────────────────────────────────────────

export async function getSequences() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("sequences")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getSequenceById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("sequences")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createSequence(seqData: {
  name: string;
  description?: string;
  category?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("sequences")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      name: seqData.name,
      description: seqData.description ?? null,
      category: seqData.category ?? "cold_outreach",
      status: "draft",
    } as SequenceInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  return { data };
}

export async function updateSequence(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    status: "draft" | "active" | "paused" | "archived";
    category: string;
  }>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("sequences")
    .update(updates as SequenceUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  revalidatePath(`/dashboard/sequences/${id}`);
  return { data };
}

export async function deleteSequence(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("sequences").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  return { success: true };
}

// ── Steps CRUD ──────────────────────────────────────────────────────────────

export async function getSequenceSteps(sequenceId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function addSequenceStep(stepData: {
  sequence_id: string;
  step_order: number;
  step_type?: string;
  delay_days?: number;
  subject?: string;
  body?: string;
  channel?: string;
  channel_config?: Record<string, unknown>;
  variants?: unknown;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_steps")
    .insert({
      sequence_id: stepData.sequence_id,
      step_order: stepData.step_order,
      step_type: stepData.step_type ?? "email",
      delay_days: stepData.delay_days ?? 0,
      subject: stepData.subject ?? null,
      body: stepData.body ?? null,
      channel: stepData.channel ?? "email",
      ...(stepData.channel_config ? { channel_config: stepData.channel_config } : {}),
      ...(stepData.variants !== undefined ? { variants: stepData.variants } : {}),
    } as StepInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  // Update step count
  const { count } = await supabase
    .from("sequence_steps")
    .select("id", { count: "exact" })
    .eq("sequence_id", stepData.sequence_id);

  await supabase
    .from("sequences")
    .update({ total_steps: count ?? 0 })
    .eq("id", stepData.sequence_id);

  revalidatePath(`/dashboard/sequences/${stepData.sequence_id}`);
  return { data };
}

export async function updateSequenceStep(
  id: string,
  updates: Partial<{
    step_order: number;
    step_type: string;
    delay_days: number;
    subject: string | null;
    body: string | null;
    channel: string | null;
    channel_config: Record<string, unknown>;
    variants: unknown;
  }>,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_steps")
    .update(updates as StepUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  if (data) {
    revalidatePath(`/dashboard/sequences/${data.sequence_id}`);
  }
  return { data };
}

export async function deleteSequenceStep(id: string, sequenceId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("sequence_steps").delete().eq("id", id);

  if (error) return { error: error.message };

  // Update step count
  const { count } = await supabase
    .from("sequence_steps")
    .select("id", { count: "exact" })
    .eq("sequence_id", sequenceId);

  await supabase
    .from("sequences")
    .update({ total_steps: count ?? 0 })
    .eq("id", sequenceId);

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return { success: true };
}

// ── Enrollments ─────────────────────────────────────────────────────────────

export async function getSequenceEnrollments(sequenceId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .select("*, leads(id, name, email, company, score)")
    .eq("sequence_id", sequenceId)
    .order("enrolled_at", { ascending: false }) as unknown as {
    data: Array<{
      id: string;
      sequence_id: string;
      lead_id: string;
      current_step: number;
      status: string;
      enrolled_at: string;
      completed_at: string | null;
      paused_at: string | null;
      updated_at: string;
      leads: { id: string; name: string; email: string; company: string | null; score: number | null } | null;
    }> | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function enrollLead(sequenceId: string, leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .insert({
      sequence_id: sequenceId,
      lead_id: leadId,
      current_step: 1,
      status: "active",
    } as EnrollmentInsert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Lead is already enrolled in this sequence" };
    return { error: error.message };
  }

  // Update enrollment count
  const { count } = await supabase
    .from("sequence_enrollments")
    .select("id", { count: "exact" })
    .eq("sequence_id", sequenceId);

  await supabase
    .from("sequences")
    .update({ total_enrolled: count ?? 0 })
    .eq("id", sequenceId);

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { data };
}

export async function enrollLeadsBulk(sequenceId: string, leadIds: string[]) {
  const supabase = await createClient();
  let enrolled = 0;
  let duplicates = 0;

  // Batch upsert in chunks of 500 (PostgREST limit)
  const chunkSize = 500;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const rows = chunk.map((leadId) => ({
      sequence_id: sequenceId,
      lead_id: leadId,
      current_step: 1,
      status: "active" as const,
    }));

    const { data, error } = await supabase
      .from("sequence_enrollments")
      .upsert(rows, { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      // Fallback: insert one-by-one if batch fails
      for (const leadId of chunk) {
        const result = await enrollLead(sequenceId, leadId);
        if (result.error) duplicates++;
        else enrolled++;
      }
    } else {
      enrolled += data?.length ?? 0;
      duplicates += chunk.length - (data?.length ?? 0);
    }
  }

  // Update enrollment count on the sequence
  const { count } = await supabase
    .from("sequence_enrollments")
    .select("id", { count: "exact" })
    .eq("sequence_id", sequenceId);

  await supabase
    .from("sequences")
    .update({ total_enrolled: count ?? 0 })
    .eq("id", sequenceId);

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  revalidatePath("/dashboard/leads");
  return { enrolled, errors: duplicates, total: leadIds.length };
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: "active" | "paused" | "completed" | "replied" | "bounced" | "unsubscribed",
) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "completed") updateData.completed_at = new Date().toISOString();
  if (status === "paused") updateData.paused_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .update(updateData)
    .eq("id", enrollmentId)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  return { data };
}

export async function getLeadEnrollments(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .select("*, sequences(id, name, status, category)")
    .eq("lead_id", leadId)
    .order("enrolled_at", { ascending: false }) as unknown as {
    data: Array<{
      id: string;
      sequence_id: string;
      lead_id: string;
      current_step: number;
      status: string;
      enrolled_at: string;
      sequences: { id: string; name: string; status: string; category: string } | null;
    }> | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Analytics ───────────────────────────────────────────────────────────────

export async function getSequenceAnalytics(sequenceId: string) {
  const supabase = await createClient();

  const [enrollmentsRes, eventsRes, stepsRes] = await Promise.all([
    supabase
      .from("sequence_enrollments")
      .select("status")
      .eq("sequence_id", sequenceId),
    supabase
      .from("sequence_events")
      .select("event_type, enrollment_id")
      .in(
        "enrollment_id",
        (
          await supabase
            .from("sequence_enrollments")
            .select("id")
            .eq("sequence_id", sequenceId)
        ).data?.map((e) => e.id) ?? [],
      ),
    supabase
      .from("sequence_steps")
      .select("id")
      .eq("sequence_id", sequenceId),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const events = eventsRes.data ?? [];

  const statusCounts: Record<string, number> = {};
  for (const e of enrollments) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  }

  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
  }

  const totalEnrolled = enrollments.length;
  const replied = statusCounts["replied"] || 0;
  const replyRate = totalEnrolled > 0 ? Math.round((replied / totalEnrolled) * 100) : 0;

  return {
    data: {
      totalEnrolled,
      statusCounts,
      eventCounts,
      replyRate,
      totalSteps: stepsRes.data?.length ?? 0,
    },
  };
}

// ── Enhanced KPI Actions (Instantly-style Dashboard) ─────────────────────

export interface SequenceWithKPIs {
  id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  total_steps: number;
  total_enrolled: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getSequencesWithKPIs(): Promise<{
  data: SequenceWithKPIs[];
  error?: string;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: sequences, error } = await supabase
    .from("sequences")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  if (!sequences) return { data: [] };

  // Compute live KPIs from email_messages via sequence_enrollments
  const result: SequenceWithKPIs[] = [];

  for (const seq of sequences) {
    // Get enrollment IDs for this sequence
    const { data: enrollments } = await supabase
      .from("sequence_enrollments")
      .select("id")
      .eq("sequence_id", seq.id);

    const enrollmentIds = enrollments?.map((e) => e.id) ?? [];
    let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;

    if (enrollmentIds.length > 0) {
      // Get email message stats for these enrollments
      const { data: events } = await supabase
        .from("sequence_events")
        .select("event_type")
        .in("enrollment_id", enrollmentIds);

      if (events) {
        for (const ev of events) {
          if (ev.event_type === "sent") sent++;
          else if (ev.event_type === "opened") opened++;
          else if (ev.event_type === "clicked") clicked++;
          else if (ev.event_type === "replied") replied++;
          else if (ev.event_type === "bounced") bounced++;
        }
      }
    }

    result.push({
      id: seq.id,
      name: seq.name,
      description: seq.description,
      status: seq.status,
      category: seq.category,
      total_steps: seq.total_steps,
      total_enrolled: seq.total_enrolled,
      total_sent: sent || seq.total_sent,
      total_opened: opened || seq.total_opened,
      total_clicked: clicked || seq.total_clicked,
      total_replied: replied || seq.total_replied,
      total_bounced: bounced || seq.total_bounced,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) : seq.open_rate,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : seq.click_rate,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : seq.reply_rate,
      settings: (seq.settings as Record<string, unknown>) ?? {},
      created_at: seq.created_at,
      updated_at: seq.updated_at,
    });
  }

  return { data: result };
}

export interface SequenceKPIs {
  totalEnrolled: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export async function getSequenceKPIs(sequenceId: string): Promise<{
  data: SequenceKPIs;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("sequence_id", sequenceId);

  const enrollmentIds = enrollments?.map((e) => e.id) ?? [];
  const totalEnrolled = enrollmentIds.length;
  let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;

  if (enrollmentIds.length > 0) {
    const { data: events } = await supabase
      .from("sequence_events")
      .select("event_type")
      .in("enrollment_id", enrollmentIds);

    if (events) {
      for (const ev of events) {
        if (ev.event_type === "sent") sent++;
        else if (ev.event_type === "opened") opened++;
        else if (ev.event_type === "clicked") clicked++;
        else if (ev.event_type === "replied") replied++;
        else if (ev.event_type === "bounced") bounced++;
      }
    }
  }

  return {
    data: {
      totalEnrolled,
      totalSent: sent,
      totalOpened: opened,
      totalClicked: clicked,
      totalReplied: replied,
      totalBounced: bounced,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
    },
  };
}

export interface StepMetrics {
  stepId: string;
  stepOrder: number;
  stepType: string;
  subject: string | null;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export async function getSequenceStepMetrics(sequenceId: string): Promise<{
  data: StepMetrics[];
  error?: string;
}> {
  const supabase = await createClient();

  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("id, step_order, step_type, subject")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  if (!steps) return { data: [] };

  const result: StepMetrics[] = [];

  for (const step of steps) {
    const { data: events } = await supabase
      .from("sequence_events")
      .select("event_type")
      .eq("step_id", step.id);

    let sent = 0, opened = 0, clicked = 0, replied = 0;
    if (events) {
      for (const ev of events) {
        if (ev.event_type === "sent") sent++;
        else if (ev.event_type === "opened") opened++;
        else if (ev.event_type === "clicked") clicked++;
        else if (ev.event_type === "replied") replied++;
      }
    }

    result.push({
      stepId: step.id,
      stepOrder: step.step_order,
      stepType: step.step_type,
      subject: step.subject,
      sent,
      opened,
      clicked,
      replied,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
    });
  }

  return { data: result };
}

export interface SequenceActivity {
  id: string;
  eventType: string;
  leadName: string;
  leadEmail: string;
  stepOrder: number;
  createdAt: string;
}

export async function getRecentSequenceActivity(
  sequenceId: string,
  limit = 20,
): Promise<{ data: SequenceActivity[]; error?: string }> {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("id, leads(name, email)")
    .eq("sequence_id", sequenceId) as unknown as {
    data: Array<{
      id: string;
      leads: { name: string; email: string } | null;
    }> | null;
  };

  if (!enrollments || enrollments.length === 0) return { data: [] };

  const enrollmentMap = new Map<string, { name: string; email: string }>();
  for (const e of enrollments) {
    if (e.leads) {
      enrollmentMap.set(e.id, { name: e.leads.name, email: e.leads.email });
    }
  }

  const enrollmentIds = enrollments.map((e) => e.id);

  const { data: events } = await supabase
    .from("sequence_events")
    .select("id, enrollment_id, event_type, step_id, created_at")
    .in("enrollment_id", enrollmentIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!events) return { data: [] };

  // Get step orders
  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("id, step_order")
    .eq("sequence_id", sequenceId);

  const stepOrderMap = new Map<string, number>();
  if (steps) {
    for (const s of steps) {
      stepOrderMap.set(s.id, s.step_order);
    }
  }

  const result: SequenceActivity[] = events.map((ev) => {
    const lead = enrollmentMap.get(ev.enrollment_id) ?? {
      name: "Unknown",
      email: "",
    };
    return {
      id: ev.id,
      eventType: ev.event_type,
      leadName: lead.name,
      leadEmail: lead.email,
      stepOrder: ev.step_id ? (stepOrderMap.get(ev.step_id) ?? 0) : 0,
      createdAt: ev.created_at,
    };
  });

  return { data: result };
}

export interface DailySequenceMetrics {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

export async function getSequenceDailyMetrics(
  sequenceId: string,
  days = 14,
): Promise<{ data: DailySequenceMetrics[]; error?: string }> {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("sequence_id", sequenceId);

  if (!enrollments || enrollments.length === 0) return { data: [] };

  const enrollmentIds = enrollments.map((e) => e.id);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data: events } = await supabase
    .from("sequence_events")
    .select("event_type, created_at")
    .in("enrollment_id", enrollmentIds)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: true });

  if (!events) return { data: [] };

  const dayMap = new Map<
    string,
    { sent: number; opened: number; clicked: number; replied: number }
  >();

  for (const ev of events) {
    const date = ev.created_at.split("T")[0];
    const entry = dayMap.get(date) ?? { sent: 0, opened: 0, clicked: 0, replied: 0 };
    if (ev.event_type === "sent") entry.sent++;
    else if (ev.event_type === "opened") entry.opened++;
    else if (ev.event_type === "clicked") entry.clicked++;
    else if (ev.event_type === "replied") entry.replied++;
    dayMap.set(date, entry);
  }

  const result: DailySequenceMetrics[] = [];
  for (const [date, counts] of dayMap) {
    result.push({ date, ...counts });
  }

  return { data: result };
}

export async function updateSequenceSettings(
  id: string,
  settings: Record<string, unknown>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("sequences")
    .update({ settings } as SequenceUpdate)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/sequences/${id}`);
  return {};
}

// ── Phase A: Clone + Performance ──────────────────────────────────────────

export async function cloneSequence(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: source, error: fetchErr } = await supabase
    .from("sequences")
    .select("name, description, category, settings")
    .eq("id", id)
    .single();

  if (fetchErr || !source) return { error: fetchErr?.message || "Sequence not found" };

  const { data: newSeq, error: insertErr } = await supabase
    .from("sequences")
    .insert({
      organization_id: orgId,
      name: `Copy of ${source.name}`,
      description: source.description,
      category: source.category,
      status: "draft",
      settings: source.settings,
    } as SequenceInsert)
    .select("id")
    .single();

  if (insertErr || !newSeq) return { error: insertErr?.message || "Failed to clone" };

  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("step_order, step_type, delay_days, subject, body, channel, variants")
    .eq("sequence_id", id)
    .order("step_order");

  if (steps && steps.length > 0) {
    const clonedSteps = steps.map((s) => ({
      sequence_id: newSeq.id,
      step_order: s.step_order,
      step_type: s.step_type,
      delay_days: s.delay_days,
      subject: s.subject,
      body: s.body,
      channel: s.channel,
      variants: s.variants,
    }));
    await supabase.from("sequence_steps").insert(clonedSteps as StepInsert[]);

    await supabase
      .from("sequences")
      .update({ total_steps: clonedSteps.length })
      .eq("id", newSeq.id);
  }

  revalidatePath("/dashboard/sequences");
  return { data: { id: newSeq.id } };
}

export interface PerformanceSummary {
  funnel: { sent: number; opened: number; clicked: number; replied: number };
  sparkline: { date: string; sent: number; replied: number }[];
  topStep: { stepOrder: number; subject: string | null; replyRate: number } | null;
  recentEvents: SequenceActivity[];
}

export async function getSequencePerformanceSummary(
  sequenceId: string,
): Promise<{ data: PerformanceSummary }> {
  const [kpis, daily, stepMetrics, activity] = await Promise.all([
    getSequenceKPIs(sequenceId),
    getSequenceDailyMetrics(sequenceId, 14),
    getSequenceStepMetrics(sequenceId),
    getRecentSequenceActivity(sequenceId, 5),
  ]);

  const funnel = {
    sent: kpis.data.totalSent,
    opened: kpis.data.totalOpened,
    clicked: kpis.data.totalClicked,
    replied: kpis.data.totalReplied,
  };

  const sparkline = (daily.data || []).map((d) => ({
    date: d.date,
    sent: d.sent,
    replied: d.replied,
  }));

  let topStep: PerformanceSummary["topStep"] = null;
  if (stepMetrics.data && stepMetrics.data.length > 0) {
    const best = stepMetrics.data.reduce((a, b) =>
      b.replyRate > a.replyRate ? b : a,
    );
    topStep = { stepOrder: best.stepOrder, subject: best.subject, replyRate: best.replyRate };
  }

  return {
    data: { funnel, sparkline, topStep, recentEvents: activity.data || [] },
  };
}

// ── Phase B: Reorder Steps ────────────────────────────────────────────────

export async function reorderSequenceSteps(
  sequenceId: string,
  stepIds: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  await getOrgId();

  for (let i = 0; i < stepIds.length; i++) {
    const { error } = await supabase
      .from("sequence_steps")
      .update({ step_order: i + 1 } as StepUpdate)
      .eq("id", stepIds[i])
      .eq("sequence_id", sequenceId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return {};
}

// ── Phase C: Leads for Enrollment ─────────────────────────────────────────

export type EnrollmentFilters = {
  search?: string;
  status?: string;
  minScore?: number;
  source?: string;
};

export async function getLeadsForEnrollment(
  sequenceId: string,
  filters: EnrollmentFilters,
): Promise<{ data: Array<{ id: string; name: string; email: string; company: string | null; score: number | null; status: string }> }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get already-enrolled lead IDs
  const { data: enrolled } = await supabase
    .from("sequence_enrollments")
    .select("lead_id")
    .eq("sequence_id", sequenceId)
    .in("status", ["active", "paused"]);

  const enrolledIds = new Set((enrolled || []).map((e) => e.lead_id));

  let query = supabase
    .from("leads")
    .select("id, name, email, company, score, status")
    .eq("organization_id", orgId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(200);

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as "hot" | "warm" | "cold");
  }

  if (filters.minScore) {
    query = query.gte("score", filters.minScore);
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  const { data, error } = await query;
  if (error) return { data: [] };

  const filtered = (data || []).filter((l) => !enrolledIds.has(l.id));
  return { data: filtered };
}

export async function getLeadsForEnrollmentCount(
  sequenceId: string,
  filters: EnrollmentFilters,
): Promise<{ count: number }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get already-enrolled lead IDs
  const { data: enrolled } = await supabase
    .from("sequence_enrollments")
    .select("lead_id")
    .eq("sequence_id", sequenceId)
    .in("status", ["active", "paused"]);

  const enrolledIds = (enrolled || []).map((e) => e.lead_id);

  let query = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as "hot" | "warm" | "cold");
  }

  if (filters.minScore) {
    query = query.gte("score", filters.minScore);
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  if (enrolledIds.length > 0) {
    query = query.not("id", "in", `(${enrolledIds.join(",")})`);
  }

  const { count, error } = await query;
  if (error) return { count: 0 };
  return { count: count ?? 0 };
}

export async function enrollAllMatchingLeads(
  sequenceId: string,
  filters: EnrollmentFilters,
): Promise<{ enrolled: number; errors: number; total: number }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get already-enrolled lead IDs
  const { data: enrolled } = await supabase
    .from("sequence_enrollments")
    .select("lead_id")
    .eq("sequence_id", sequenceId)
    .in("status", ["active", "paused"]);

  const enrolledIds = new Set((enrolled || []).map((e) => e.lead_id));

  let query = supabase
    .from("leads")
    .select("id")
    .eq("organization_id", orgId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as "hot" | "warm" | "cold");
  }

  if (filters.minScore) {
    query = query.gte("score", filters.minScore);
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  const { data, error } = await query;
  if (error) return { enrolled: 0, errors: 0, total: 0 };

  const leadIds = (data || []).map((l) => l.id).filter((id) => !enrolledIds.has(id));
  if (leadIds.length === 0) return { enrolled: 0, errors: 0, total: 0 };

  return enrollLeadsBulk(sequenceId, leadIds);
}

// ── Phase D: Analytics ────────────────────────────────────────────────────

export interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

export async function getSequenceHeatmapData(
  sequenceId: string,
): Promise<{ data: HeatmapCell[] }> {
  const supabase = await createClient();
  await getOrgId();

  const { data: enrollmentIds } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("sequence_id", sequenceId);

  if (!enrollmentIds || enrollmentIds.length === 0) return { data: [] };

  const ids = enrollmentIds.map((e) => e.id);
  const { data: events } = await supabase
    .from("sequence_events")
    .select("created_at")
    .in("enrollment_id", ids)
    .eq("event_type", "email_replied");

  if (!events) return { data: [] };

  const heatmap = new Map<string, number>();
  for (const ev of events) {
    const d = new Date(ev.created_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    heatmap.set(key, (heatmap.get(key) || 0) + 1);
  }

  const result: HeatmapCell[] = [];
  heatmap.forEach((count, key) => {
    const [day, hour] = key.split("-").map(Number);
    result.push({ day, hour, count });
  });

  return { data: result };
}

export interface ABComparison {
  stepOrder: number;
  stepId: string;
  subjectA: string | null;
  subjectB: string;
  variantA: { sent: number; opened: number; clicked: number; replied: number; replyRate: number };
  variantB: { sent: number; opened: number; clicked: number; replied: number; replyRate: number };
  winner: "A" | "B" | null;
}

export async function getSequenceABComparison(
  sequenceId: string,
): Promise<{ data: ABComparison[] }> {
  const [stepsRes, metricsRes] = await Promise.all([
    getSequenceSteps(sequenceId),
    getSequenceStepMetrics(sequenceId),
  ]);

  const steps = stepsRes.data || [];
  const metricsMap = new Map<string, StepMetrics>();
  for (const m of metricsRes.data || []) metricsMap.set(m.stepId, m);

  const result: ABComparison[] = [];

  for (const step of steps) {
    const variants = step.variants as Array<{ id: string; subject: string; body: string; weight: number; sent?: number; opened?: number; clicked?: number; replied?: number }> | null;
    if (!variants || variants.length === 0) continue;

    const varB = variants[0];
    const totalMetrics = metricsMap.get(step.id);
    if (!totalMetrics) continue;

    const bSent = varB.sent || 0;
    const bOpened = varB.opened || 0;
    const bClicked = varB.clicked || 0;
    const bReplied = varB.replied || 0;

    const aSent = Math.max(0, totalMetrics.sent - bSent);
    const aOpened = Math.max(0, totalMetrics.opened - bOpened);
    const aClicked = Math.max(0, totalMetrics.clicked - bClicked);
    const aReplied = Math.max(0, totalMetrics.replied - bReplied);

    const aReplyRate = aSent > 0 ? Math.round((aReplied / aSent) * 100) : 0;
    const bReplyRate = bSent > 0 ? Math.round((bReplied / bSent) * 100) : 0;

    const minSample = 10;
    let winner: "A" | "B" | null = null;
    if (aSent >= minSample && bSent >= minSample) {
      winner = aReplyRate > bReplyRate ? "A" : bReplyRate > aReplyRate ? "B" : null;
    }

    result.push({
      stepOrder: step.step_order,
      stepId: step.id,
      subjectA: step.subject,
      subjectB: varB.subject,
      variantA: { sent: aSent, opened: aOpened, clicked: aClicked, replied: aReplied, replyRate: aReplyRate },
      variantB: { sent: bSent, opened: bOpened, clicked: bClicked, replied: bReplied, replyRate: bReplyRate },
      winner,
    });
  }

  return { data: result };
}

export interface TimeToReplyData {
  medianHours: number;
  avgHours: number;
  count: number;
}

export async function getTimeToFirstReply(
  sequenceId: string,
): Promise<{ data: TimeToReplyData }> {
  const supabase = await createClient();
  await getOrgId();

  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("id, enrolled_at")
    .eq("sequence_id", sequenceId)
    .eq("status", "replied");

  if (!enrollments || enrollments.length === 0) {
    return { data: { medianHours: 0, avgHours: 0, count: 0 } };
  }

  const times: number[] = [];
  for (const enrollment of enrollments) {
    const { data: firstReply } = await supabase
      .from("sequence_events")
      .select("created_at")
      .eq("enrollment_id", enrollment.id)
      .eq("event_type", "email_replied")
      .order("created_at")
      .limit(1)
      .single();

    if (firstReply) {
      const diff = new Date(firstReply.created_at).getTime() - new Date(enrollment.enrolled_at).getTime();
      times.push(diff / (1000 * 60 * 60));
    }
  }

  if (times.length === 0) return { data: { medianHours: 0, avgHours: 0, count: 0 } };

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const avg = times.reduce((s, t) => s + t, 0) / times.length;

  return {
    data: {
      medianHours: Math.round(median * 10) / 10,
      avgHours: Math.round(avg * 10) / 10,
      count: times.length,
    },
  };
}

// ── Phase E: Paginated Activity ───────────────────────────────────────────

export async function getSequenceActivityPaginated(
  sequenceId: string,
  options: { eventTypes?: string[]; search?: string; offset?: number; limit?: number },
): Promise<{ data: (SequenceActivity & { leadId: string })[]; hasMore: boolean; total: number }> {
  const supabase = await createClient();
  await getOrgId();

  const limit = options.limit || 20;
  const offset = options.offset || 0;

  const { data: enrollmentRows } = await supabase
    .from("sequence_enrollments")
    .select("id, lead_id, leads!inner(id, name, email)")
    .eq("sequence_id", sequenceId);

  if (!enrollmentRows) return { data: [], hasMore: false, total: 0 };

  const enrollMap = new Map<string, { leadId: string; name: string; email: string }>();
  for (const e of enrollmentRows) {
    const lead = e.leads as unknown as { id: string; name: string; email: string };
    enrollMap.set(e.id, { leadId: lead.id, name: lead.name, email: lead.email });
  }

  const enrollmentIds = enrollmentRows.map((e) => e.id);

  // Filter by search (lead name/email)
  let filteredIds = enrollmentIds;
  if (options.search) {
    const s = options.search.toLowerCase();
    filteredIds = enrollmentIds.filter((eid) => {
      const info = enrollMap.get(eid);
      return info && (info.name.toLowerCase().includes(s) || info.email.toLowerCase().includes(s));
    });
  }

  if (filteredIds.length === 0) return { data: [], hasMore: false, total: 0 };

  let query = supabase
    .from("sequence_events")
    .select("id, enrollment_id, step_id, event_type, created_at, sequence_steps!inner(step_order)", { count: "exact" })
    .in("enrollment_id", filteredIds)
    .order("created_at", { ascending: false });

  if (options.eventTypes && options.eventTypes.length > 0) {
    query = query.in("event_type", options.eventTypes);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: events, count } = await query;
  if (!events) return { data: [], hasMore: false, total: 0 };

  const result = events.map((ev) => {
    const info = enrollMap.get(ev.enrollment_id) || { leadId: "", name: "Unknown", email: "" };
    const step = ev.sequence_steps as unknown as { step_order: number };
    return {
      id: ev.id,
      eventType: ev.event_type,
      leadName: info.name,
      leadEmail: info.email,
      leadId: info.leadId,
      stepOrder: step?.step_order || 0,
      createdAt: ev.created_at,
    };
  });

  return { data: result, hasMore: (count || 0) > offset + limit, total: count || 0 };
}
