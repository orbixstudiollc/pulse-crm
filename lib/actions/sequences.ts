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
  let errors = 0;

  for (const leadId of leadIds) {
    const result = await enrollLead(sequenceId, leadId);
    if (result.error) errors++;
    else enrolled++;
  }

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  revalidatePath("/dashboard/leads");
  return { enrolled, errors, total: leadIds.length };
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
