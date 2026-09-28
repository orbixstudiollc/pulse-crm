"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "../helpers";
import { revalidatePath } from "next/cache";
import { escapePostgrestLike } from "@/lib/security";

// ── List / Search LF Leads ─────────────────────────────────────────────────

export async function getLFLeads(
  filters?: {
    campaignId?: string;
    status?: string;
    search?: string;
    minScore?: number;
    maxScore?: number;
    imported?: boolean;
  },
  pagination?: { offset?: number; limit?: number }
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("lf_leads")
    .select("*, lf_campaigns!inner(organization_id)", { count: "exact" })
    .eq("lf_campaigns.organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.campaignId)
    query = query.eq("campaign_id", filters.campaignId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.imported !== undefined)
    query = query.eq("imported", filters.imported);
  if (filters?.minScore !== undefined)
    query = query.gte("score", filters.minScore);
  if (filters?.maxScore !== undefined)
    query = query.lte("score", filters.maxScore);
  if (filters?.search) {
    query = query.or(
      (() => {
        const q = escapePostgrestLike(filters.search);
        return `display_name.ilike.%${q}%,email.ilike.%${q}%,website.ilike.%${q}%,mapped_data->>company.ilike.%${q}%`;
      })()
    );
  }

  const limit = pagination?.limit ?? 25;
  const offset = pagination?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

// ── Get Single LF Lead ─────────────────────────────────────────────────────

export async function getLFLeadById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data: lead, error } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) return { error: error?.message ?? "Not found", data: null };

  // Get personalization data
  const { data: personalization } = await supabase
    .from("lf_lead_personalization")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return { data: { ...lead, personalization: personalization ?? [] } };
}

// ── Update Lead Status ──────────────────────────────────────────────────────

export async function updateLFLeadStatus(id: string, status: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("lf_leads")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message, data: null };

  // Log analytics event
  const statusEvent = {
    organization_id: orgId,
    event_type: "lead_status_changed",
    campaign_id: data.campaign_id,
    lead_id: id,
    metadata: { new_status: status },
  };
  await supabase.from("lf_analytics_events").insert(statusEvent as never);

  revalidatePath("/dashboard/lead-finder");
  return { data };
}

// ── Bulk Delete LF Leads ────────────────────────────────────────────────────

export async function deleteLFLeads(ids: string[]) {
  const supabase = await createClient();
  await getOrgId();

  // Clean up personalization first
  await supabase.from("lf_lead_personalization").delete().in("lead_id", ids);
  const { error } = await supabase.from("lf_leads").delete().in("id", ids);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-finder");
  return { success: true };
}

// ── Import LF Leads → CRM Leads ────────────────────────────────────────────

export async function importLFLeadsToCRM(leadIds: string[]) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  // Get LF leads that haven't been imported yet
  const { data: lfLeads, error: fetchErr } = await supabase
    .from("lf_leads")
    .select("*")
    .in("id", leadIds)
    .eq("imported", false);

  if (fetchErr || !lfLeads?.length) {
    return {
      error: fetchErr?.message ?? "No leads to import",
      imported: 0,
      importedIds: [] as string[],
    };
  }

  // Insert into main leads table one by one (mirrors importScrapedLeads pattern)
  let imported = 0;
  const importedIds: string[] = [];

  for (const lf of lfLeads) {
    const leadName = lf.display_name || lf.email || "Unknown";
    const mapped = (lf.mapped_data ?? {}) as Record<string, unknown>;
    const raw = (lf.raw_data ?? {}) as Record<string, unknown>;

    const insertData: Record<string, unknown> = {
      organization_id: orgId,
      created_by: user.id,
      name: leadName,
      email: lf.email ?? "",
      phone: lf.phone ?? null,
      website: lf.website ?? null,
      company: (mapped.company ?? raw.company ?? null) as string | null,
      linkedin: (mapped.linkedin ?? raw.linkedin ?? null) as string | null,
      location: (mapped.location ?? raw.location ?? null) as string | null,
      industry: (mapped.industry ?? raw.industry ?? null) as string | null,
      source: "LinkedIn",
      status: "cold",
      estimated_value: 0,
      score: lf.score ?? 0,
    };

    const { data: newLead, error: insertErr } = await supabase
      .from("leads")
      .insert(insertData as never)
      .select("id")
      .single();

    if (!insertErr && newLead) {
      await supabase
        .from("lf_leads")
        .update({ imported: true, imported_lead_id: newLead.id })
        .eq("id", lf.id);
      imported++;
      importedIds.push(newLead.id);
    }
  }

  // Log analytics event
  const importEvent = {
    organization_id: orgId,
    event_type: "leads_imported",
    metadata: { count: imported, lead_ids: importedIds },
  };
  await supabase.from("lf_analytics_events").insert(importEvent as never);

  revalidatePath("/dashboard/lead-finder");
  revalidatePath("/dashboard/leads");
  return { imported, importedIds };
}

// ── Export LF Leads for CSV ─────────────────────────────────────────────────

export async function exportLFLeads(campaignId?: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("lf_leads")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };

  // Map to export-friendly flat structure
  const exportData = (data ?? []).map((l) => {
    const mapped = (l.mapped_data ?? {}) as Record<string, unknown>;
    return {
      name: l.display_name,
      email: l.email,
      phone: l.phone,
      website: l.website,
      company: mapped.company ?? "",
      location: mapped.location ?? "",
      industry: mapped.industry ?? "",
      score: l.score,
      status: l.status,
      source: l.source,
      imported: l.imported,
      created_at: l.created_at,
    };
  });

  return { data: exportData };
}
