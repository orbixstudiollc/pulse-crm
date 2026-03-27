"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";

// ── Marketing Audits CRUD ───────────────────────────────────────────────────

export async function getMarketingAudits(filters?: {
  status?: string;
  audit_type?: string;
  customer_id?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("marketing_audits" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.audit_type) query = query.eq("audit_type", filters.audit_type);
  if (filters?.customer_id) query = query.eq("customer_id", filters.customer_id);

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getMarketingAuditById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("marketing_audits" as any)
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createMarketingAudit(auditData: {
  website_url: string;
  business_name?: string;
  business_type?: string;
  audit_type?: string;
  customer_id?: string;
  lead_id?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("marketing_audits" as any)
    .insert({
      organization_id: orgId,
      website_url: auditData.website_url,
      business_name: auditData.business_name ?? null,
      business_type: auditData.business_type ?? null,
      audit_type: auditData.audit_type ?? "full",
      customer_id: auditData.customer_id ?? null,
      lead_id: auditData.lead_id ?? null,
      status: "pending",
      progress: 0,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { data };
}

export async function updateMarketingAudit(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("marketing_audits" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  revalidatePath(`/dashboard/marketing/${id}`);
  return { data };
}

export async function deleteMarketingAudit(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("marketing_audits" as any).delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { success: true };
}

// ── Marketing Content CRUD ──────────────────────────────────────────────────

export async function getMarketingContent(filters?: {
  content_type?: string;
  audit_id?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("marketing_content" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.content_type) query = query.eq("content_type", filters.content_type);
  if (filters?.audit_id) query = query.eq("audit_id", filters.audit_id);

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getMarketingContentById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("marketing_content" as any)
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function createMarketingContent(contentData: {
  content_type: string;
  title: string;
  audit_id?: string;
  customer_id?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  model_used?: string;
  tokens_used?: number;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("marketing_content" as any)
    .insert({
      organization_id: orgId,
      content_type: contentData.content_type,
      title: contentData.title,
      audit_id: contentData.audit_id ?? null,
      customer_id: contentData.customer_id ?? null,
      content: (contentData.content ?? {}) as Json,
      metadata: (contentData.metadata ?? {}) as Json,
      model_used: contentData.model_used ?? null,
      tokens_used: contentData.tokens_used ?? 0,
      status: "completed",
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { data };
}

export async function deleteMarketingContent(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("marketing_content" as any).delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { success: true };
}

// ── Marketing Reports CRUD ──────────────────────────────────────────────────

export async function getMarketingReports(auditId?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("marketing_reports" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (auditId) query = query.eq("audit_id", auditId);

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function createMarketingReport(reportData: {
  audit_id: string;
  report_type: string;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("marketing_reports" as any)
    .insert({
      organization_id: orgId,
      audit_id: reportData.audit_id,
      report_type: reportData.report_type,
      title: reportData.title,
      content: reportData.content ?? null,
      metadata: (reportData.metadata ?? {}) as Json,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { data };
}

export async function deleteMarketingReport(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("marketing_reports" as any).delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { success: true };
}

// ── Marketing Action Items CRUD ─────────────────────────────────────────────

export async function getMarketingActionItems(auditId?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("marketing_action_items" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (auditId) query = query.eq("audit_id", auditId);

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function updateMarketingActionItem(
  id: string,
  updates: {
    status?: string;
    assigned_to?: string | null;
    due_date?: string | null;
    completed_at?: string | null;
  },
) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("marketing_action_items" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { data };
}

export async function createMarketingActionItems(
  auditId: string,
  items: Array<{
    title: string;
    description?: string;
    category?: string;
    tier?: string;
    priority?: string;
    impact_estimate?: string;
    effort?: string;
  }>,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const rows = items.map((item) => ({
    organization_id: orgId,
    audit_id: auditId,
    title: item.title,
    description: item.description ?? null,
    category: item.category ?? null,
    tier: item.tier ?? "medium_term",
    priority: item.priority ?? "medium",
    impact_estimate: item.impact_estimate ?? null,
    effort: item.effort ?? null,
    status: "pending",
  }));

  const { data, error } = await supabase
    .from("marketing_action_items" as any)
    .insert(rows)
    .select();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/marketing");
  return { data };
}
