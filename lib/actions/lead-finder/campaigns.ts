"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "../helpers";
import { revalidatePath } from "next/cache";
import { authorizeActors } from "@/lib/lead-finder/apify/policy-server";

export async function getLFCampaigns() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: campaigns, error } = await supabase
    .from("lf_campaigns")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };

  // Enrich each campaign with stats
  const enriched = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { count: leadCount } = await supabase
        .from("lf_leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", c.id);

      const { count: enrichedCount } = await supabase
        .from("lf_leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .not("status", "in", '("new","enriching")');

      const { data: scoreData } = await supabase
        .from("lf_leads")
        .select("score")
        .eq("campaign_id", c.id)
        .not("status", "in", '("new","enriching")');

      const avgScore = scoreData?.length
        ? Math.round(
            scoreData.reduce((s, l) => s + (l.score ?? 0), 0) /
              scoreData.length
          )
        : 0;

      // Cost totals
      const { data: runs } = await supabase
        .from("lf_apify_runs")
        .select("cost_usd")
        .eq("campaign_id", c.id);
      const apifyCost = (runs ?? []).reduce(
        (s, r) => s + (r.cost_usd ?? 0),
        0
      );

      const { data: leads } = await supabase
        .from("lf_leads")
        .select("llm_cost_usd")
        .eq("campaign_id", c.id);
      const llmCost = (leads ?? []).reduce(
        (s, l) => s + (l.llm_cost_usd ?? 0),
        0
      );

      const totalCost = Math.round((apifyCost + llmCost) * 10000) / 10000;
      const avgCostPerLead =
        (leadCount ?? 0) > 0
          ? Math.round((totalCost / (leadCount ?? 1)) * 10000) / 10000
          : 0;

      return {
        ...c,
        leadCount: leadCount ?? 0,
        enrichedCount: enrichedCount ?? 0,
        avgScore,
        totalCost,
        avgCostPerLead,
      };
    })
  );

  return { data: enriched };
}

export async function getLFCampaignById(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: campRows, error } = await supabase
    .from("lf_campaigns")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .limit(1);
  const campaign = campRows?.[0] ?? null;

  if (error || !campaign)
    return { error: error?.message ?? "Not found", data: null };

  // Get leads
  const { data: leads } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  // Get runs
  const { data: runs } = await supabase
    .from("lf_apify_runs")
    .select("*")
    .eq("campaign_id", id)
    .order("started_at", { ascending: false });

  // Calculate stats
  const campaignLeads = leads ?? [];
  const enrichedLeads = campaignLeads.filter(
    (l) => l.status !== "new" && l.status !== "enriching"
  );
  const apifyCost = (runs ?? []).reduce(
    (s, r) => s + (r.cost_usd ?? 0),
    0
  );
  const llmCost = campaignLeads.reduce(
    (s, l) => s + (l.llm_cost_usd ?? 0),
    0
  );
  const totalCost = Math.round((apifyCost + llmCost) * 10000) / 10000;

  const stats = {
    totalLeads: campaignLeads.length,
    qualifiedLeads: campaignLeads.filter((l) => l.status === "qualified")
      .length,
    convertedLeads: campaignLeads.filter((l) => l.status === "converted")
      .length,
    enrichedLeads: enrichedLeads.length,
    avgScore:
      campaignLeads.length > 0
        ? Math.round(
            campaignLeads.reduce((s, l) => s + (l.score ?? 0), 0) /
              campaignLeads.length
          )
        : 0,
    apifyCost: Math.round(apifyCost * 10000) / 10000,
    llmCost: Math.round(llmCost * 10000) / 10000,
    totalCost,
    avgCostPerLead:
      campaignLeads.length > 0
        ? Math.round((totalCost / campaignLeads.length) * 10000) / 10000
        : 0,
  };

  return {
    data: { ...campaign, leads: campaignLeads, runs: runs ?? [], stats },
  };
}

export async function createLFCampaign(data: {
  name: string;
  description?: string;
  target_niche: string;
  apify_actors?: string[];
  actor_configs?: Record<string, Record<string, unknown>>;
  kpi_definitions?: unknown[];
  lead_field_definitions?: unknown[];
  schedule_frequency?: string;
  ai_provider?: string;
  auto_enrich?: boolean;
  status?: string;
}) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const actors = data.apify_actors ?? [];
  if (actors.length > 0) {
    try {
      await authorizeActors(orgId, actors);
    } catch (err) {
      return { error: (err as Error).message, data: null };
    }
  }

  const insertData: Record<string, unknown> = {
    organization_id: orgId,
    created_by: user.id,
    name: data.name,
    description: data.description ?? null,
    target_niche: data.target_niche,
    apify_actors: data.apify_actors ?? [],
    actor_configs: data.actor_configs ?? {},
    kpi_definitions: data.kpi_definitions ?? [],
    lead_field_definitions: data.lead_field_definitions ?? [],
    schedule_frequency: data.schedule_frequency ?? "once",
    ai_provider: data.ai_provider ?? "anthropic",
    auto_enrich: data.auto_enrich ?? true,
    status: data.status ?? "draft",
  };
  const { data: campaign, error } = await supabase
    .from("lf_campaigns")
    .insert(insertData as never)
    .select()
    .single();

  if (error) return { error: error.message, data: null };

  // Log analytics event
  const analyticsEvent = {
    organization_id: orgId,
    event_type: "campaign_created",
    campaign_id: campaign.id,
    metadata: { name: campaign.name },
  };
  await supabase.from("lf_analytics_events").insert(analyticsEvent as never);

  revalidatePath("/dashboard/lead-finder");
  return { data: campaign };
}

export async function updateLFCampaign(
  id: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Only allow known columns to avoid Supabase errors
  const allowed = [
    "name", "description", "target_niche", "apify_actors", "actor_configs",
    "kpi_definitions", "lead_field_definitions", "schedule_frequency",
    "ai_provider", "auto_enrich", "max_leads_per_run", "max_pages_per_search",
    "enrichment_concurrency", "status",
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) safeUpdates[key] = updates[key];
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { error: "No valid fields to update", data: null };
  }

  if ("apify_actors" in safeUpdates) {
    const actors = safeUpdates.apify_actors as string[];
    if (!Array.isArray(actors)) {
      return { error: "apify_actors must be an array", data: null };
    }
    if (actors.length > 0) {
      try {
        await authorizeActors(orgId, actors);
      } catch (err) {
        return { error: (err as Error).message, data: null };
      }
    }
  }

  const { data: rows, error } = await supabase
    .from("lf_campaigns")
    .update(safeUpdates as never)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select();
  const data = rows?.[0] ?? null;

  if (error) return { error: error.message, data: null };
  revalidatePath("/dashboard/lead-finder");
  return { data };
}

export async function deleteLFCampaign(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Clean up analytics events (cascade handles leads/runs via FK).
  // Explicit org filters here are defense-in-depth on top of RLS.
  await supabase
    .from("lf_analytics_events")
    .delete()
    .eq("campaign_id", id)
    .eq("organization_id", orgId);
  const { error } = await supabase
    .from("lf_campaigns")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/lead-finder");
  return { success: true };
}
