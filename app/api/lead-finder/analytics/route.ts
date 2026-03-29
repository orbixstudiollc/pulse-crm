import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const campaignId = req.nextUrl.searchParams.get("campaignId");

    // All leads
    let leadsQuery = supabase
      .from("lf_leads")
      .select(
        "id, status, score, created_at, llm_cost_usd, apify_cost_usd, discovery_apify_cost_usd, discovery_llm_cost_usd, campaign_id",
        { count: "exact" }
      )
      .eq("organization_id", orgId);
    if (campaignId) leadsQuery = leadsQuery.eq("campaign_id", campaignId);
    const { data: leads, count: totalLeads } = await leadsQuery;
    const allLeads = leads ?? [];

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const lead of allLeads) {
      statusBreakdown[lead.status] = (statusBreakdown[lead.status] || 0) + 1;
    }

    // Score distribution
    const scoreBuckets: Record<string, number> = {
      "0-20": 0,
      "21-40": 0,
      "41-60": 0,
      "61-80": 0,
      "81-100": 0,
    };
    for (const lead of allLeads) {
      const s = lead.score ?? 0;
      if (s <= 20) scoreBuckets["0-20"]++;
      else if (s <= 40) scoreBuckets["21-40"]++;
      else if (s <= 60) scoreBuckets["41-60"]++;
      else if (s <= 80) scoreBuckets["61-80"]++;
      else scoreBuckets["81-100"]++;
    }

    // Avg score
    const avgScore =
      allLeads.length > 0
        ? Math.round(
            allLeads.reduce((s, l) => s + (l.score ?? 0), 0) / allLeads.length
          )
        : 0;

    // Cost totals
    const totalLlmCost = allLeads.reduce(
      (s, l) =>
        s + (l.llm_cost_usd ?? 0) + (l.discovery_llm_cost_usd ?? 0),
      0
    );
    const totalApifyCost = allLeads.reduce(
      (s, l) =>
        s + (l.apify_cost_usd ?? 0) + (l.discovery_apify_cost_usd ?? 0),
      0
    );
    const totalCost = totalLlmCost + totalApifyCost;

    // Leads by source (via apify runs)
    const { data: runRows } = await supabase
      .from("lf_apify_runs")
      .select("actor_id, result_count")
      .eq("organization_id", orgId)
      .eq("status", "succeeded");
    const leadsBySource: Record<string, number> = {};
    for (const run of runRows ?? []) {
      const src = run.actor_id || "unknown";
      leadsBySource[src] = (leadsBySource[src] || 0) + (run.result_count ?? 0);
    }

    // Conversions
    const conversions = statusBreakdown["converted"] ?? 0;
    const conversionRate =
      allLeads.length > 0
        ? Math.round((conversions / allLeads.length) * 1000) / 10
        : 0;

    // Leads over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLeads = allLeads.filter(
      (l) => new Date(l.created_at) >= thirtyDaysAgo
    );
    const dailyCounts: Record<string, number> = {};
    for (const lead of recentLeads) {
      const day = lead.created_at.split("T")[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }

    // Campaign count
    let campaignsQuery = supabase
      .from("lf_campaigns")
      .select("id, status", { count: "exact" })
      .eq("organization_id", orgId);
    if (campaignId) campaignsQuery = campaignsQuery.eq("id", campaignId);
    const { data: campaigns, count: totalCampaigns } = await campaignsQuery;
    const activeCampaigns = (campaigns ?? []).filter(
      (c) => c.status === "active"
    ).length;

    // Recent Apify runs (last 10) for activity feed
    let runsQuery = supabase
      .from("lf_apify_runs")
      .select("id, actor_id, status, result_count, cost_usd, started_at, campaign_id")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(10);
    if (campaignId) runsQuery = runsQuery.eq("campaign_id", campaignId);
    const { data: recentRuns } = await runsQuery;

    // Build activity from runs + recent leads
    const activity: {
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }[] = [];

    for (const run of recentRuns ?? []) {
      activity.push({
        id: run.id,
        type: run.status === "succeeded" ? "discovery_success" : "discovery_run",
        description: `Apify actor ${run.actor_id} — ${run.result_count ?? 0} results${run.cost_usd ? ` ($${run.cost_usd.toFixed(4)})` : ""}`,
        timestamp: run.started_at,
      });
    }

    // Recent leads (last 5)
    const newest = [...allLeads]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5);
    for (const lead of newest) {
      activity.push({
        id: `lead-${lead.id}`,
        type: "lead_added",
        description: `New lead discovered`,
        timestamp: lead.created_at,
      });
    }

    activity.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      data: {
        totalLeads: totalLeads ?? 0,
        totalCampaigns: totalCampaigns ?? 0,
        activeCampaigns,
        conversions,
        conversionRate,
        statusBreakdown,
        scoreDistribution: scoreBuckets,
        avgScore,
        leadsBySource,
        costs: {
          llm: Math.round(totalLlmCost * 10000) / 10000,
          apify: Math.round(totalApifyCost * 10000) / 10000,
          total: Math.round(totalCost * 10000) / 10000,
          avgPerLead:
            (totalLeads ?? 0) > 0
              ? Math.round((totalCost / (totalLeads ?? 1)) * 10000) / 10000
              : 0,
        },
        leadsOverTime: dailyCounts,
        recentActivity: activity.slice(0, 10),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
