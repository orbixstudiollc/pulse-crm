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

    // Total leads
    let leadsQuery = supabase
      .from("lf_leads")
      .select("id, status, score, created_at, llm_cost_usd, apify_cost_usd, discovery_apify_cost_usd, discovery_llm_cost_usd", { count: "exact" })
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
    const scoreBuckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    for (const lead of allLeads) {
      const s = lead.score ?? 0;
      if (s <= 20) scoreBuckets["0-20"]++;
      else if (s <= 40) scoreBuckets["21-40"]++;
      else if (s <= 60) scoreBuckets["41-60"]++;
      else if (s <= 80) scoreBuckets["61-80"]++;
      else scoreBuckets["81-100"]++;
    }

    // Average score
    const avgScore =
      allLeads.length > 0
        ? Math.round(
            allLeads.reduce((s, l) => s + (l.score ?? 0), 0) / allLeads.length
          )
        : 0;

    // Cost totals
    const totalLlmCost = allLeads.reduce(
      (s, l) => s + (l.llm_cost_usd ?? 0) + (l.discovery_llm_cost_usd ?? 0),
      0
    );
    const totalApifyCost = allLeads.reduce(
      (s, l) => s + (l.apify_cost_usd ?? 0) + (l.discovery_apify_cost_usd ?? 0),
      0
    );
    const totalCost = totalLlmCost + totalApifyCost;

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
    const { count: totalCampaigns } = await campaignsQuery;

    return NextResponse.json({
      data: {
        totalLeads: totalLeads ?? 0,
        totalCampaigns: totalCampaigns ?? 0,
        statusBreakdown,
        scoreDistribution: scoreBuckets,
        avgScore,
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
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
