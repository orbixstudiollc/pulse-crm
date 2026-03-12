"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type TrackingScriptInsert = Database["public"]["Tables"]["tracking_scripts"]["Insert"];
type VisitorRow = Database["public"]["Tables"]["website_visitors"]["Row"];

// ── Types ────────────────────────────────────────────────────────────────────

export type VisitorFilters = {
  search?: string;
  status?: string;
  dateRange?: "today" | "7d" | "30d" | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type VisitorWithVisits = VisitorRow & {
  recent_pages?: { page_url: string; page_title: string | null; created_at: string }[];
};

// ── Tracking Scripts ─────────────────────────────────────────────────────────

export async function getTrackingScripts() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("tracking_scripts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createTrackingScript(domain: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Normalize domain
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

  const { data, error } = await supabase
    .from("tracking_scripts")
    .insert({ organization_id: orgId, domain: cleanDomain } satisfies TrackingScriptInsert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A tracking script for this domain already exists.");
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/website-visitors");
  return data;
}

export async function toggleTrackingScript(id: string, isActive: boolean) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { error } = await supabase
    .from("tracking_scripts")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/website-visitors");
}

export async function deleteTrackingScript(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { error } = await supabase
    .from("tracking_scripts")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/website-visitors");
}

// ── Visitors ─────────────────────────────────────────────────────────────────

export async function getWebsiteVisitors(filters: VisitorFilters = {}) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const {
    search,
    status,
    dateRange = "30d",
    sortBy = "last_seen",
    sortOrder = "desc",
    page = 1,
    perPage = 50,
  } = filters;

  let query = supabase
    .from("website_visitors")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId);

  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,company_domain.ilike.%${search}%,ip_address.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`
    );
  }

  if (status && status !== "all") {
    query = query.eq("status", status as VisitorRow["status"]);
  }

  if (dateRange !== "all") {
    const now = new Date();
    let since: Date;
    if (dateRange === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === "7d") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    query = query.gte("last_seen", since.toISOString());
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { visitors: data || [], total: count || 0 };
}

export async function getVisitorDetails(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: visitor, error } = await supabase
    .from("website_visitors")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error) throw new Error(error.message);

  const { data: visits } = await supabase
    .from("website_visits")
    .select("*")
    .eq("visitor_id", id)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  return { visitor, visits: visits || [] };
}

export async function updateVisitorStatus(id: string, status: VisitorRow["status"]) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { error } = await supabase
    .from("website_visitors")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/website-visitors");
}

export async function convertVisitorToLead(visitorId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get visitor data
  const { data: visitor, error: vErr } = await supabase
    .from("website_visitors")
    .select("*")
    .eq("id", visitorId)
    .eq("organization_id", orgId)
    .single();

  if (vErr || !visitor) throw new Error("Visitor not found");

  // Create lead from visitor
  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .insert({
      organization_id: orgId,
      name: visitor.company_name || "Unknown Visitor",
      company: visitor.company_name || null,
      email: visitor.company_domain ? `info@${visitor.company_domain}` : `visitor-${visitorId.slice(0, 8)}@unknown.com`,
      source: "Website" as const,
      status: "warm" as const,
      location: [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || null,
      website: visitor.company_domain || null,
    })
    .select()
    .single();

  if (lErr) throw new Error(lErr.message);

  // Update visitor with lead_id and status
  await supabase
    .from("website_visitors")
    .update({ lead_id: lead.id, status: "converted" as const })
    .eq("id", visitorId)
    .eq("organization_id", orgId);

  revalidatePath("/dashboard/website-visitors");
  revalidatePath("/dashboard/leads");
  return lead;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getVisitorStats() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, weekRes, monthRes, companiesRes, hotRes, convertedRes] = await Promise.all([
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("last_seen", todayStart),
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("last_seen", weekAgo),
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("last_seen", monthAgo),
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).not("company_name", "is", null),
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "hot"),
    supabase.from("website_visitors").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "converted"),
  ]);

  return {
    visitorsToday: todayRes.count || 0,
    visitorsThisWeek: weekRes.count || 0,
    visitorsThisMonth: monthRes.count || 0,
    companiesIdentified: companiesRes.count || 0,
    hotVisitors: hotRes.count || 0,
    convertedToLeads: convertedRes.count || 0,
  };
}
