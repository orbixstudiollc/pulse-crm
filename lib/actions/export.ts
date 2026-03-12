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
