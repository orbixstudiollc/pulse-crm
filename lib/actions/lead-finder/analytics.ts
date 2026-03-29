"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "../helpers";

// ── Dashboard KPIs & Analytics ──────────────────────────────────────────────

export async function getLFAnalytics() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Total campaigns
  const { count: totalCampaigns } = await supabase
    .from("lf_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  // Active campaigns
  const { count: activeCampaigns } = await supabase
    .from("lf_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");

  // All leads for this org
  const { data: allLeads } = await supabase
    .from("lf_leads")
    .select("id, status, score, source, imported, llm_cost_usd, apify_cost_usd, campaign_id")
    .eq("organization_id", orgId);

  const leads = allLeads ?? [];
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.status === "qualified").length;
  const convertedLeads = leads.filter((l) => l.status === "converted").length;
  const importedLeads = leads.filter((l) => l.imported).length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 10000) / 100 : 0;

  // Average score
  const scoredLeads = leads.filter((l) => l.score != null && l.score > 0);
  const avgScore = scoredLeads.length > 0
    ? Math.round(scoredLeads.reduce((s, l) => s + (l.score ?? 0), 0) / scoredLeads.length)
    : 0;

  // Leads by status
  const leadsByStatus: Record<string, number> = {};
  for (const l of leads) {
    const st = l.status ?? "unknown";
    leadsByStatus[st] = (leadsByStatus[st] ?? 0) + 1;
  }

  // Leads by source
  const leadsBySource: Record<string, number> = {};
  for (const l of leads) {
    const src = l.source ?? "unknown";
    leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;
  }

  // Score distribution
  const scoreDistribution = [
    { range: "0-20", count: 0 },
    { range: "21-40", count: 0 },
    { range: "41-60", count: 0 },
    { range: "61-80", count: 0 },
    { range: "81-100", count: 0 },
  ];
  for (const l of leads) {
    const s = l.score ?? 0;
    if (s <= 20) scoreDistribution[0].count++;
    else if (s <= 40) scoreDistribution[1].count++;
    else if (s <= 60) scoreDistribution[2].count++;
    else if (s <= 80) scoreDistribution[3].count++;
    else scoreDistribution[4].count++;
  }

  // Cost totals
  const llmCostTotal = leads.reduce((s, l) => s + (l.llm_cost_usd ?? 0), 0);

  // Apify run costs
  const { data: runs } = await supabase
    .from("lf_apify_runs")
    .select("cost_usd")
    .eq("organization_id", orgId);

  const apifyCostTotal = (runs ?? []).reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const totalCost = Math.round((apifyCostTotal + llmCostTotal) * 10000) / 10000;
  const avgCostPerLead = totalLeads > 0 ? Math.round((totalCost / totalLeads) * 10000) / 10000 : 0;

  return {
    data: {
      totalCampaigns: totalCampaigns ?? 0,
      activeCampaigns: activeCampaigns ?? 0,
      totalLeads,
      qualifiedLeads,
      convertedLeads,
      importedLeads,
      conversionRate,
      avgScore,
      leadsByStatus,
      leadsBySource,
      scoreDistribution,
      apifyCostTotal: Math.round(apifyCostTotal * 10000) / 10000,
      llmCostTotal: Math.round(llmCostTotal * 10000) / 10000,
      totalCost,
      avgCostPerLead,
    },
  };
}

// ── Cost Breakdown ──────────────────────────────────────────────────────────

export async function getLFCostBreakdown() {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Get all campaigns for the org
  const { data: campaigns } = await supabase
    .from("lf_campaigns")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (!campaigns?.length) {
    return { data: { byCampaign: [], byOperation: [] } };
  }

  const campaignIds = campaigns.map((c) => c.id);

  // Apify costs per campaign
  const { data: runs } = await supabase
    .from("lf_apify_runs")
    .select("campaign_id, cost_usd, actor_id")
    .in("campaign_id", campaignIds);

  // LLM costs per campaign (from leads)
  const { data: leads } = await supabase
    .from("lf_leads")
    .select("campaign_id, llm_cost_usd")
    .in("campaign_id", campaignIds);

  // LLM cost log details
  const { data: llmCosts } = await supabase
    .from("lf_llm_costs")
    .select("campaign_id, operation, cost_usd, input_tokens, output_tokens, model")
    .eq("organization_id", orgId);

  // Build per-campaign breakdown
  const byCampaign = campaigns.map((c) => {
    const campaignRuns = (runs ?? []).filter((r) => r.campaign_id === c.id);
    const campaignLeads = (leads ?? []).filter((l) => l.campaign_id === c.id);
    const apifyCost = campaignRuns.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
    const llmCost = campaignLeads.reduce((s, l) => s + (l.llm_cost_usd ?? 0), 0);

    return {
      campaignId: c.id,
      campaignName: c.name,
      apifyCost: Math.round(apifyCost * 10000) / 10000,
      llmCost: Math.round(llmCost * 10000) / 10000,
      totalCost: Math.round((apifyCost + llmCost) * 10000) / 10000,
      runCount: campaignRuns.length,
      leadCount: campaignLeads.length,
    };
  });

  // Build per-operation breakdown
  const opMap: Record<string, { operation: string; totalCost: number; totalTokens: number; count: number }> = {};
  for (const lc of llmCosts ?? []) {
    const op = lc.operation ?? "unknown";
    if (!opMap[op]) opMap[op] = { operation: op, totalCost: 0, totalTokens: 0, count: 0 };
    opMap[op].totalCost += lc.cost_usd ?? 0;
    opMap[op].totalTokens += (lc.input_tokens ?? 0) + (lc.output_tokens ?? 0);
    opMap[op].count++;
  }
  const byOperation = Object.values(opMap).map((o) => ({
    ...o,
    totalCost: Math.round(o.totalCost * 10000) / 10000,
  }));

  return { data: { byCampaign, byOperation } };
}
