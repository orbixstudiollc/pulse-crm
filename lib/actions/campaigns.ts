"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type EmailAccountInsert = Database["public"]["Tables"]["email_accounts"]["Insert"];
type EmailAccountUpdate = Database["public"]["Tables"]["email_accounts"]["Update"];

// ── Email Accounts ──────────────────────────────────────────────────────────

export async function getEmailAccounts() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function createEmailAccount(account: {
  email_address: string;
  display_name?: string;
  provider?: "gmail" | "microsoft" | "custom_imap";
  smtp_config?: Record<string, unknown>;
  daily_send_limit?: number;
  warmup_enabled?: boolean;
  warmup_limit?: number;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("email_accounts")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      email_address: account.email_address,
      display_name: account.display_name ?? null,
      provider: account.provider ?? "custom_imap",
      smtp_config: (account.smtp_config as unknown as Database["public"]["Tables"]["email_accounts"]["Insert"]["smtp_config"]) ?? null,
      daily_send_limit: account.daily_send_limit ?? 50,
      warmup_enabled: account.warmup_enabled ?? false,
      warmup_limit: account.warmup_limit ?? 5,
    } satisfies EmailAccountInsert)
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/campaigns");
  return { data };
}

export async function updateEmailAccount(
  id: string,
  updates: {
    email_address?: string;
    display_name?: string;
    provider?: "gmail" | "microsoft" | "custom_imap";
    smtp_config?: Record<string, unknown> | null;
    daily_send_limit?: number;
    warmup_enabled?: boolean;
    warmup_limit?: number;
    status?: "active" | "disconnected" | "error" | "warming_up";
  }
) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("email_accounts")
    .update(updates as EmailAccountUpdate)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function deleteEmailAccount(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function testEmailAccount(id: string) {
  // Placeholder — in production, this would attempt an SMTP connection
  await getOrgId();
  return { success: true, message: "Connection test placeholder — SMTP integration pending" };
}

// ── Campaign Tags ───────────────────────────────────────────────────────────

export async function getCampaignTags() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("campaign_tags")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function createCampaignTag(name: string, color?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("campaign_tags")
    .insert({ organization_id: orgId, name, color: color ?? "#6366f1" })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/campaigns");
  return { data };
}

export async function deleteCampaignTag(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("campaign_tags")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

// ── Sequence ↔ Tags ─────────────────────────────────────────────────────────

export async function updateSequenceTags(sequenceId: string, tagIds: string[]) {
  const supabase = await createClient();
  await getOrgId();

  // Delete existing tags for this sequence
  await supabase
    .from("sequence_tags")
    .delete()
    .eq("sequence_id", sequenceId);

  // Insert new tags
  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId) => ({ sequence_id: sequenceId, tag_id: tagId }));
    const { error } = await supabase.from("sequence_tags").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

// ── Sequence ↔ Email Accounts ───────────────────────────────────────────────

export async function assignEmailAccounts(sequenceId: string, accountIds: string[]) {
  const supabase = await createClient();
  await getOrgId();

  await supabase
    .from("sequence_email_accounts")
    .delete()
    .eq("sequence_id", sequenceId);

  if (accountIds.length > 0) {
    const rows = accountIds.map((id) => ({ sequence_id: sequenceId, email_account_id: id }));
    const { error } = await supabase.from("sequence_email_accounts").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

// ── Schedule ────────────────────────────────────────────────────────────────

export async function updateSequenceSchedule(
  sequenceId: string,
  schedule: {
    timezone?: string;
    windows?: Array<{ days: number[]; start_hour: number; end_hour: number }>;
    dailyLimit?: number;
    priority?: string;
  }
) {
  const supabase = await createClient();
  await getOrgId();

  const updates: Record<string, unknown> = {};
  if (schedule.timezone) updates.schedule_timezone = schedule.timezone;
  if (schedule.windows) updates.schedule_windows = schedule.windows;
  if (schedule.dailyLimit) updates.daily_send_limit = schedule.dailyLimit;
  if (schedule.priority) updates.priority = schedule.priority;

  const { error } = await supabase
    .from("sequences")
    .update(updates)
    .eq("id", sequenceId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

// ── Campaign Dashboard Stats ────────────────────────────────────────────────

export async function getCampaignDashboardStats() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get all sequences for this org
  const { data: sequences } = await supabase
    .from("sequences")
    .select("*")
    .eq("organization_id", orgId);

  const all = sequences ?? [];
  const active = all.filter((s) => s.status === "active");
  const paused = all.filter((s) => s.status === "paused");
  const drafts = all.filter((s) => s.status === "draft");

  const totalSentToday = all.reduce((sum, s) => sum + (s.sent_today ?? 0), 0);
  const totalEnrolled = all.reduce((sum, s) => sum + s.total_enrolled, 0);
  const avgReplyRate =
    all.length > 0
      ? all.reduce((sum, s) => sum + s.reply_rate, 0) / all.length
      : 0;

  // Email accounts
  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, status")
    .eq("organization_id", orgId);

  const accountsArr = accounts ?? [];
  const activeAccounts = accountsArr.filter((a) => a.status === "active" || a.status === "warming_up").length;

  // Count campaign runs
  const { count: campaignRunCount } = await supabase
    .from("campaign_runs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  return {
    data: {
      totalCampaigns: all.length,
      activeCampaigns: active.length,
      pausedCampaigns: paused.length,
      draftCampaigns: drafts.length,
      totalEnrolled,
      totalSentToday,
      avgReplyRate: Math.round(avgReplyRate * 10) / 10,
      totalAccounts: accountsArr.length,
      activeAccounts,
      campaignRuns: campaignRunCount ?? 0,
    },
  };
}

// ── Campaigns With Tags (for list page) ─────────────────────────────────────

export type CampaignWithTags = Database["public"]["Tables"]["sequences"]["Row"] & {
  tags: Array<{ id: string; name: string; color: string }>;
  emailAccountCount: number;
};

export async function getCampaignsWithTags(filters?: {
  search?: string;
  status?: string;
  tagId?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get sequences
  let query = supabase
    .from("sequences")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as Database["public"]["Enums"]["sequence_status"]);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data: sequences, error } = await query;
  if (error) return { error: error.message, data: [] };

  const seqs = sequences ?? [];
  if (seqs.length === 0) return { data: [] };

  // Get tags for all sequences
  const seqIds = seqs.map((s) => s.id);
  const { data: tagLinks } = await supabase
    .from("sequence_tags")
    .select("sequence_id, tag_id")
    .in("sequence_id", seqIds);

  // Get all campaign tags for the org
  const { data: allTags } = await supabase
    .from("campaign_tags")
    .select("*")
    .eq("organization_id", orgId);

  const tagsMap = new Map((allTags ?? []).map((t) => [t.id, t]));

  // Get email account counts
  const { data: accountLinks } = await supabase
    .from("sequence_email_accounts")
    .select("sequence_id, email_account_id")
    .in("sequence_id", seqIds);

  // Build results
  const results: CampaignWithTags[] = seqs.map((seq) => {
    const seqTagIds = (tagLinks ?? [])
      .filter((tl) => tl.sequence_id === seq.id)
      .map((tl) => tl.tag_id);
    const tags = seqTagIds
      .map((tid) => tagsMap.get(tid))
      .filter(Boolean)
      .map((t) => ({ id: t!.id, name: t!.name, color: t!.color }));
    const emailAccountCount = (accountLinks ?? []).filter(
      (al) => al.sequence_id === seq.id
    ).length;

    return { ...seq, tags, emailAccountCount };
  });

  // Filter by tag if specified
  if (filters?.tagId) {
    return { data: results.filter((r) => r.tags.some((t) => t.id === filters.tagId)) };
  }

  return { data: results };
}

// ── Account Warmup Status ───────────────────────────────────────────────────

export async function getAccountWarmupStatus() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("email_address");

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Campaign Runs (Multi-sequence campaigns) ────────────────────────────────

export async function getCampaignRuns(filters?: {
  status?: string;
  search?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("campaign_runs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getCampaignRunById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("campaign_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createCampaignRun(campaign: {
  name: string;
  description?: string;
  sequence_id?: string;
  audience_type?: "manual" | "filter" | "saved_search";
  audience_filters?: Record<string, unknown>;
  audience_lead_ids?: string[];
  email_account_ids?: string[];
  rotation_strategy?: string;
  daily_send_limit?: number;
  start_date?: string;
  schedule_timezone?: string;
  schedule_windows?: Array<{ days: number[]; start_hour: number; end_hour: number }>;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("campaign_runs")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      name: campaign.name,
      description: campaign.description ?? null,
      status: "draft",
      sequence_id: campaign.sequence_id ?? null,
      audience_type: campaign.audience_type ?? "manual",
      audience_filters: (campaign.audience_filters ?? {}) as unknown as Json,
      audience_lead_ids: campaign.audience_lead_ids ?? [],
      email_account_ids: campaign.email_account_ids ?? [],
      rotation_strategy: campaign.rotation_strategy ?? "round_robin",
      daily_send_limit: campaign.daily_send_limit ?? 100,
      start_date: campaign.start_date ?? null,
      schedule_timezone: campaign.schedule_timezone ?? "UTC",
      schedule_windows: (campaign.schedule_windows ?? []) as unknown as Json,
    })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/campaigns");
  return { data };
}

export async function updateCampaignRun(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    sequence_id: string | null;
    audience_type: string;
    audience_filters: Record<string, unknown>;
    audience_lead_ids: string[];
    email_account_ids: string[];
    rotation_strategy: string;
    daily_send_limit: number;
    start_date: string | null;
    schedule_timezone: string;
    schedule_windows: unknown[];
    status: string;
  }>
) {
  const supabase = await createClient();
  await getOrgId();

  // Cast to satisfy Json type for JSONB fields
  const sanitized = { ...updates } as Record<string, unknown>;
  if (updates.audience_filters) sanitized.audience_filters = updates.audience_filters as unknown as Json;
  if (updates.schedule_windows) sanitized.schedule_windows = updates.schedule_windows as unknown as Json;

  const { error } = await supabase
    .from("campaign_runs")
    .update(sanitized as Database["public"]["Tables"]["campaign_runs"]["Update"])
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function deleteCampaignRun(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("campaign_runs")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function launchCampaignRun(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: campaign, error: fetchErr } = await supabase
    .from("campaign_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !campaign) {
    return { error: fetchErr?.message ?? "Campaign not found" };
  }

  if (campaign.status !== "draft" && campaign.status !== "paused") {
    return { error: "Campaign must be in draft or paused status to launch" };
  }

  if (!campaign.sequence_id) {
    return { error: "Campaign must have a sequence assigned" };
  }

  // Resolve audience
  let leadIds: string[] = campaign.audience_lead_ids ?? [];

  if (campaign.audience_type === "filter" && campaign.audience_filters) {
    const filters = campaign.audience_filters as Record<string, unknown>;
    let query = supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId);

    if (filters.status) query = query.eq("status", filters.status as "hot" | "warm" | "cold");
    if (filters.source) query = query.eq("source", filters.source as "Website" | "Referral" | "LinkedIn" | "Event" | "Google Ads" | "Cold Call");
    if (filters.min_score) query = query.gte("score", filters.min_score as number);
    if (filters.max_score) query = query.lte("score", filters.max_score as number);
    if (filters.industry) query = query.eq("industry", filters.industry as string);

    const { data: filteredLeads } = await query.limit(5000);
    leadIds = (filteredLeads ?? []).map((l) => l.id);
  }

  if (!leadIds.length) {
    return { error: "No leads in audience" };
  }

  // Enroll leads in sequence
  let enrolled = 0;
  const accountIds = campaign.email_account_ids ?? [];

  for (const leadId of leadIds) {
    const { data: existing } = await supabase
      .from("sequence_enrollments")
      .select("id")
      .eq("sequence_id", campaign.sequence_id)
      .eq("lead_id", leadId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) continue;

    const assignedAccountId = accountIds.length > 0
      ? accountIds[enrolled % accountIds.length]
      : null;

    const { data: enrollment } = await supabase
      .from("sequence_enrollments")
      .insert({
        sequence_id: campaign.sequence_id,
        lead_id: leadId,
        current_step: 0,
        status: "active",
        campaign_id: id,
        ...(assignedAccountId ? { email_account_id: assignedAccountId } : {}),
      })
      .select("id")
      .single();

    await supabase.from("campaign_leads").insert({
      campaign_id: id,
      lead_id: leadId,
      enrollment_id: enrollment?.id ?? null,
      status: "enrolled",
    });

    enrolled++;
  }

  await supabase
    .from("campaign_runs")
    .update({
      status: "active",
      total_audience: leadIds.length,
      total_enrolled: enrolled,
    })
    .eq("id", id);

  revalidatePath("/dashboard/campaigns");
  return { success: true, enrolled, total: leadIds.length };
}

export async function pauseCampaignRun(id: string) {
  return updateCampaignRun(id, { status: "paused" });
}

export async function resumeCampaignRun(id: string) {
  return updateCampaignRun(id, { status: "active" });
}

export async function getCampaignRunMetrics(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data: campaign } = await supabase
    .from("campaign_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) return { error: "Campaign not found", data: null };

  const { data: campaignLeads } = await supabase
    .from("campaign_leads")
    .select("*")
    .eq("campaign_id", id);

  const enrollmentIds = (campaignLeads ?? [])
    .map((cl) => cl.enrollment_id)
    .filter(Boolean) as string[];

  let events: Array<{ event_type: string; created_at: string }> = [];
  if (enrollmentIds.length > 0) {
    const { data: seqEvents } = await supabase
      .from("sequence_events")
      .select("event_type, created_at")
      .in("enrollment_id", enrollmentIds);
    events = seqEvents ?? [];
  }

  const sent = events.filter((e) => e.event_type === "sent").length;
  const opened = events.filter((e) => e.event_type === "opened").length;
  const clicked = events.filter((e) => e.event_type === "clicked").length;
  const replied = events.filter((e) => e.event_type === "replied").length;
  const bounced = events.filter((e) => e.event_type === "bounced").length;

  return {
    data: {
      ...campaign,
      total_sent: sent,
      total_opened: opened,
      total_clicked: clicked,
      total_replied: replied,
      total_bounced: bounced,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      bounce_rate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
    },
  };
}

// ── Booking URL (Organization Setting) ──────────────────────────────────────

export async function getBookingConfig() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("organizations")
    .select("booking_url, booking_provider")
    .eq("id", orgId)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function updateBookingConfig(config: {
  booking_url?: string;
  booking_provider?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { error } = await supabase
    .from("organizations")
    .update(config as Database["public"]["Tables"]["organizations"]["Update"])
    .eq("id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}
