"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";
import { calculateLeadScore } from "./scoring";
import { calculateICPMatch } from "./icp";
import { escapePostgrestLike, pickSortColumn } from "@/lib/security";
import { normalizeLeadSource } from "@/lib/leads/source";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const SORTABLE = ["created_at", "updated_at", "name", "email", "company", "status", "source", "score", "estimated_value", "last_contacted_at", "next_followup"] as const;

// Rewrites `source` to its enum value. On create an empty source is dropped
// so the column default applies.
function withLeadSource(
  data: Record<string, unknown>,
  mode: "create" | "update",
): { data: Record<string, unknown> } | { error: string } {
  if (!("source" in data)) return { data };
  const source = normalizeLeadSource(data.source);
  if (source === undefined) return { error: `Unknown lead source "${String(data.source)}"` };
  const next: Record<string, unknown> = { ...data, source };
  if (source === null && mode === "create") delete next.source;
  return { data: next };
}

// ── Types ────────────────────────────────────────────────────────────────────

export type LeadFilters = {
  search?: string;
  status?: string;
  source?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns leads as a JSON string to avoid RSC serialization depth limits
 * on deeply nested JSONB columns (qualification_data, score_breakdown, etc.).
 */
export async function getLeadsAsJson(filters: LeadFilters = {}): Promise<{ json: string; count: number }> {
  const result = await getLeads(filters);
  return { json: JSON.stringify(result.data), count: result.count };
}

export async function getLeads(filters: LeadFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const {
    search,
    status,
    source,
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    perPage = 50,
  } = filters;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .is("converted_at", null);

  if (search) {
    const q = escapePostgrestLike(search);
    query = query.or(
      `name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`,
    );
  }

  if (status && status !== "all") {
    query = query.eq("status", status as Database["public"]["Enums"]["lead_status"]);
  }

  if (source && source !== "all") {
    query = query.eq("source", source as Database["public"]["Enums"]["lead_source"]);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  query = query.order(pickSortColumn(sortBy, SORTABLE, "created_at"), { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

export async function getLeadById(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data };
}

export async function getLeadNotes(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function getLeadActivities(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createLead(leadData: Record<string, unknown>) {
  const normalized = withLeadSource(leadData, "create");
  if ("error" in normalized) return { error: normalized.error };

  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...normalized.data,
      organization_id: orgId,
      created_by: user.id,
    } as LeadInsert)
    .select()
    .single();

  if (error) return { error: error.message };

  // Auto-calculate lead score + ICP match after creation
  if (data?.id) {
    calculateLeadScore(data.id).catch(() => {});
    calculateICPMatch(data.id).catch(() => {});
    // Fire automation rules
    import("@/lib/automation/runner").then(({ evaluateLeadAgainstRules }) =>
      evaluateLeadAgainstRules(data.id, "lead_created", {}).catch(() => {}),
    );
  }

  revalidatePath("/dashboard/leads");
  return { data };
}

export async function updateLead(
  id: string,
  updates: Record<string, unknown>,
) {
  const normalized = withLeadSource(updates, "update");
  if ("error" in normalized) return { error: normalized.error };

  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("leads")
    .update(normalized.data as LeadUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  // Recalculate score + ICP match after update
  calculateLeadScore(id).catch(() => {});
  calculateICPMatch(id).catch(() => {});
  // Fire automation rules
  import("@/lib/automation/runner").then(({ evaluateLeadAgainstRules }) =>
    evaluateLeadAgainstRules(id, "lead_updated", {
      changed_fields: Object.keys(updates),
    }).catch(() => {}),
  );

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${id}`);
  return { data };
}

export async function deleteLead(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/leads");
  return { success: true };
}

export async function addLeadNote(leadId: string, content: string) {
  const supabase = await createClient();
  const { user, profile } = await getCurrentUserProfile();

  const authorName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({
      lead_id: leadId,
      author_id: user.id,
      author_name: authorName,
      content,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { data };
}

export async function convertLeadToCustomer(leadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  // Fetch the lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) return { error: leadError?.message || "Lead not found" };
  if (lead.converted_at) return { error: "This lead has already been converted" };

  // Split name into first/last
  const nameParts = (lead.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Create customer from lead data
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      first_name: firstName,
      last_name: lastName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      website: lead.website,
      industry: lead.industry,
      status: "active",
      plan: "free",
    })
    .select()
    .single();

  if (customerError) return { error: customerError.message };

  // Keep the lead (and its notes, activities and history) and mark it converted.
  const { error: markError } = await supabase
    .from("leads")
    .update({ converted_at: new Date().toISOString(), converted_customer_id: customer.id })
    .eq("id", leadId);
  if (markError) {
    await supabase.from("customers").delete().eq("id", customer.id);
    return { error: markError.message };
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/customers");
  return { data: customer };
}

// ── Lead Count (for sidebar usage widget) ─────────────────────────────────

export async function getLeadCount() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("converted_at", null);

  return { count: count ?? 0 };
}

export async function getConvertedLeadCount() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("converted_at", "is", null);

  return { count: count ?? 0 };
}
