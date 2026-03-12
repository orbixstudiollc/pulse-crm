"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ScrapedLeadInsert = Database["public"]["Tables"]["scraped_leads"]["Insert"];

// ── Search / Query Scraped Leads ────────────────────────────────────────────

export async function searchScrapedLeads(
  filters?: {
    search?: string;
    company?: string;
    title?: string;
    location?: string;
    industry?: string;
    verified?: boolean;
    imported?: boolean;
    searchId?: string;
    source?: string;
  },
  pagination?: { offset?: number; limit?: number }
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("scraped_leads")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
    );
  }
  if (filters?.company) query = query.ilike("company", `%${filters.company}%`);
  if (filters?.title) query = query.ilike("title", `%${filters.title}%`);
  if (filters?.location) query = query.ilike("location", `%${filters.location}%`);
  if (filters?.industry) query = query.ilike("industry", `%${filters.industry}%`);
  if (filters?.verified !== undefined) query = query.eq("verified", filters.verified);
  if (filters?.imported !== undefined) query = query.eq("imported", filters.imported);
  if (filters?.searchId) query = query.eq("search_id", filters.searchId);
  if (filters?.source) query = query.eq("source", filters.source);

  const limit = pagination?.limit ?? 25;
  const offset = pagination?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return { error: error.message, data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

// ── Add Scraped Leads (bulk insert) ─────────────────────────────────────────

export async function addScrapedLeads(
  leads: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    title?: string;
    company?: string;
    industry?: string;
    location?: string;
    linkedin_url?: string;
    company_website?: string;
    company_size?: string;
    phone?: string;
    source?: string;
    search_id?: string;
  }>
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const rows: ScrapedLeadInsert[] = leads.map((lead) => ({
    organization_id: orgId,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    email: lead.email ?? null,
    title: lead.title ?? null,
    company: lead.company ?? null,
    industry: lead.industry ?? null,
    location: lead.location ?? null,
    linkedin_url: lead.linkedin_url ?? null,
    company_website: lead.company_website ?? null,
    company_size: lead.company_size ?? null,
    phone: lead.phone ?? null,
    source: lead.source ?? "search",
    search_id: lead.search_id ?? null,
  }));

  const { data, error } = await supabase
    .from("scraped_leads")
    .insert(rows)
    .select();

  if (error) return { error: error.message, data: [] };
  revalidatePath("/dashboard/lead-scraper");
  return { data: data ?? [] };
}

// ── Saved Searches ──────────────────────────────────────────────────────────

export async function saveSearch(
  name: string,
  filters: Record<string, unknown>,
  resultCount?: number
) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("lead_searches")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      name,
      filters: filters as Database["public"]["Tables"]["lead_searches"]["Insert"]["filters"],
      result_count: resultCount ?? 0,
      last_run_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/lead-scraper");
  return { data };
}

export async function getSavedSearches() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("lead_searches")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function deleteSavedSearch(id: string) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("lead_searches")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-scraper");
  return { success: true };
}

export async function runSavedSearch(id: string) {
  const supabase = await createClient();
  await getOrgId();

  // Get the search
  const { data: search, error } = await supabase
    .from("lead_searches")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !search) return { error: error?.message ?? "Search not found", data: null };

  // Update last_run_at
  await supabase
    .from("lead_searches")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", id);

  // Return the filters so client can apply them
  return { data: { id: search.id, name: search.name, filters: search.filters } };
}

// ── Import Scraped Leads → CRM Leads ────────────────────────────────────────

export async function importScrapedLeads(scrapedLeadIds: string[]) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  // Get scraped leads
  const { data: scraped, error: fetchErr } = await supabase
    .from("scraped_leads")
    .select("*")
    .in("id", scrapedLeadIds)
    .eq("imported", false);

  if (fetchErr || !scraped?.length) {
    return { error: fetchErr?.message ?? "No leads to import", imported: 0 };
  }

  // Insert into leads table
  let imported = 0;
  for (const sl of scraped) {
    const leadName = [sl.first_name, sl.last_name].filter(Boolean).join(" ") || sl.email || "Unknown";
    const { data: newLead, error: insertErr } = await supabase
      .from("leads")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        name: leadName,
        email: sl.email ?? "",
        company: sl.company ?? null,
        phone: sl.phone ?? null,
        linkedin: sl.linkedin_url ?? null,
        location: sl.location ?? null,
        industry: sl.industry ?? null,
        website: sl.company_website ?? null,
        employees: sl.company_size ?? null,
        source: "LinkedIn" as const,
        status: "cold" as const,
        estimated_value: 0,
        score: 0,
      })
      .select("id")
      .single();

    if (!insertErr && newLead) {
      await supabase
        .from("scraped_leads")
        .update({ imported: true, imported_lead_id: newLead.id })
        .eq("id", sl.id);
      imported++;
    }
  }

  revalidatePath("/dashboard/lead-scraper");
  revalidatePath("/dashboard/leads");
  return { imported };
}

// ── CSV Import ──────────────────────────────────────────────────────────────

export async function importCSVToScrapedLeads(
  rows: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    title?: string;
    company?: string;
    industry?: string;
    location?: string;
    phone?: string;
    linkedin_url?: string;
    company_website?: string;
    company_size?: string;
  }>
) {
  return addScrapedLeads(rows.map((r) => ({ ...r, source: "csv_upload" })));
}

// ── Delete Scraped Leads ────────────────────────────────────────────────────

export async function deleteScrapedLeads(ids: string[]) {
  const supabase = await createClient();
  await getOrgId();

  const { error } = await supabase
    .from("scraped_leads")
    .delete()
    .in("id", ids);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-scraper");
  return { success: true };
}

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getScraperStats() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { count: totalCount } = await supabase
    .from("scraped_leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  const { count: verifiedCount } = await supabase
    .from("scraped_leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("verified", true);

  const { count: importedCount } = await supabase
    .from("scraped_leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("imported", true);

  const { count: searchCount } = await supabase
    .from("lead_searches")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  return {
    data: {
      totalLeads: totalCount ?? 0,
      verified: verifiedCount ?? 0,
      imported: importedCount ?? 0,
      savedSearches: searchCount ?? 0,
    },
  };
}

// ── Verify Emails (MX-based verification) ──────────────────────────────────

export async function verifyScrapedLeadEmails(ids: string[]) {
  const supabase = await createClient();
  await getOrgId();

  // Get emails for selected leads
  const { data: leads, error: fetchErr } = await supabase
    .from("scraped_leads")
    .select("id, email")
    .in("id", ids);

  if (fetchErr || !leads?.length) {
    return { error: fetchErr?.message ?? "No leads found", verified: 0, invalid: 0 };
  }

  const { verifyBulk } = await import("@/lib/verification/email-verifier");
  const emails = leads.filter((l) => l.email).map((l) => l.email as string);

  if (!emails.length) {
    return { error: "No emails to verify", verified: 0, invalid: 0 };
  }

  const results = await verifyBulk(emails, { concurrency: 10 });

  let verified = 0;
  let invalid = 0;

  for (const lead of leads) {
    if (!lead.email) continue;
    const result = results.find((r) => r.email === lead.email);
    if (!result) continue;

    const isValid = result.status === "valid" || result.status === "catch_all";
    await supabase
      .from("scraped_leads")
      .update({
        verified: isValid,
        verification_status: result.status,
        confidence_score: result.confidence,
        verified_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (isValid) verified++;
    else invalid++;
  }

  revalidatePath("/dashboard/lead-scraper");
  return { success: true, verified, invalid, total: leads.length };
}

// ── Recurring Scrape Management ─────────────────────────────────────────────

export async function toggleRecurringScrape(
  searchId: string,
  isRecurring: boolean,
  options?: {
    frequency?: "daily" | "weekly";
    autoImport?: boolean;
    autoEnrollSequenceId?: string | null;
  }
) {
  const supabase = await createClient();
  await getOrgId();

  const updates: Record<string, unknown> = {
    is_recurring: isRecurring,
  };

  if (isRecurring) {
    updates.schedule_frequency = options?.frequency ?? "daily";
    updates.auto_import = options?.autoImport ?? false;
    updates.auto_enroll_sequence_id = options?.autoEnrollSequenceId ?? null;
    // Set next run to tomorrow
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(6, 0, 0, 0);
    updates.next_run_at = nextRun.toISOString();
  } else {
    updates.next_run_at = null;
  }

  const { error } = await supabase
    .from("lead_searches")
    .update(updates)
    .eq("id", searchId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-scraper");
  return { success: true };
}

// ── Export (return data for client-side CSV generation) ──────────────────────

export async function exportScrapedLeads(filters?: {
  searchId?: string;
  verified?: boolean;
  imported?: boolean;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("scraped_leads")
    .select("first_name, last_name, email, title, company, industry, location, linkedin_url, company_website, company_size, phone, verified, imported")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (filters?.searchId) query = query.eq("search_id", filters.searchId);
  if (filters?.verified !== undefined) query = query.eq("verified", filters.verified);
  if (filters?.imported !== undefined) query = query.eq("imported", filters.imported);

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}
