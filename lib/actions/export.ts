"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

export async function exportLeadsToCSV(filters?: { status?: string; source?: string }) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("leads")
    .select("name, email, company, phone, status, source, score, industry, estimated_value, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status as "hot" | "warm" | "cold");
  }
  if (filters?.source) {
    query = query.eq("source", filters.source as "Website" | "Referral" | "LinkedIn" | "Event" | "Google Ads" | "Cold Call");
  }

  const { data, error } = await query;
  if (error) return { error: error.message, csv: "" };
  if (!data || data.length === 0) return { error: "No leads found", csv: "" };

  const headers = ["Name", "Email", "Company", "Phone", "Status", "Source", "Score", "Industry", "Estimated Value", "Created At"];
  const rows = data.map(lead => [
    lead.name,
    lead.email,
    lead.company || "",
    lead.phone || "",
    lead.status,
    lead.source,
    String(lead.score),
    lead.industry || "",
    String(lead.estimated_value),
    lead.created_at,
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return { csv };
}

export async function exportCustomersToCSV() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("customers")
    .select("first_name, last_name, email, company, status, plan, health_score, mrr, last_contact, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, csv: "" };
  if (!data || data.length === 0) return { error: "No customers found", csv: "" };

  const headers = ["Name", "Email", "Company", "Status", "Plan", "Health Score", "MRR", "Last Contact", "Created At"];
  const rows = data.map(c => [
    `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    c.email,
    c.company || "",
    c.status || "",
    c.plan || "",
    String(c.health_score ?? ""),
    String(c.mrr ?? ""),
    c.last_contact || "",
    c.created_at,
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return { csv };
}

export async function exportCalendarEventsToCSV(month?: number, year?: number) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("calendar_events")
    .select("title, type, date, start_time, end_time, status, description, related_name")
    .eq("organization_id", orgId)
    .order("date", { ascending: false });

  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 0 : month + 1;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-01`;
    query = query.gte("date", startDate).lt("date", endDate);
  }

  const { data, error } = await query;
  if (error) return { error: error.message, csv: "" };
  if (!data || data.length === 0) return { error: "No events found", csv: "" };

  const headers = ["Title", "Type", "Date", "Start Time", "End Time", "Status", "Description", "Related To"];
  const rows = data.map(e => [
    e.title,
    e.type || "",
    e.date,
    e.start_time || "",
    e.end_time || "",
    e.status || "",
    e.description || "",
    e.related_name || "",
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return { csv };
}
