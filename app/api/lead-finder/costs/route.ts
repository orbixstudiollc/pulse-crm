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

    // Apify runs
    let runsQuery = supabase
      .from("lf_apify_runs")
      .select("id, actor_id, campaign_id, cost_usd, started_at, status, result_count")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false });
    if (campaignId) runsQuery = runsQuery.eq("campaign_id", campaignId);
    const { data: runs } = await runsQuery;

    // LLM costs
    let llmQuery = supabase
      .from("lf_llm_costs")
      .select(
        "id, provider, model, operation, input_tokens, output_tokens, cost_usd, campaign_id, created_at"
      )
      .eq("organization_id", orgId);
    if (campaignId) llmQuery = llmQuery.eq("campaign_id", campaignId);
    const { data: llmCosts } = await llmQuery;

    // Campaign names
    const { data: campaigns } = await supabase
      .from("lf_campaigns")
      .select("id, name")
      .eq("organization_id", orgId);
    const campaignNames: Record<string, string> = {};
    for (const c of campaigns ?? []) campaignNames[c.id] = c.name;

    // Lead counts per campaign
    const { data: leadRows } = await supabase
      .from("lf_leads")
      .select("campaign_id", { count: "exact" })
      .eq("organization_id", orgId);
    const leadCountByCampaign: Record<string, number> = {};
    for (const l of leadRows ?? []) {
      leadCountByCampaign[l.campaign_id] =
        (leadCountByCampaign[l.campaign_id] || 0) + 1;
    }

    const allRuns = runs ?? [];
    const allLlmCosts = llmCosts ?? [];

    // Aggregate by actor
    const apifyCostByActor: Record<string, { count: number; totalCost: number }> = {};
    for (const run of allRuns) {
      const key = run.actor_id;
      if (!apifyCostByActor[key])
        apifyCostByActor[key] = { count: 0, totalCost: 0 };
      apifyCostByActor[key].count++;
      apifyCostByActor[key].totalCost += run.cost_usd ?? 0;
    }

    // Aggregate LLM by operation
    const llmCostByOperation: Record<
      string,
      { count: number; totalCost: number; inputTokens: number; outputTokens: number }
    > = {};
    for (const cost of allLlmCosts) {
      const key = cost.operation;
      if (!llmCostByOperation[key])
        llmCostByOperation[key] = {
          count: 0,
          totalCost: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      llmCostByOperation[key].count++;
      llmCostByOperation[key].totalCost += cost.cost_usd ?? 0;
      llmCostByOperation[key].inputTokens += cost.input_tokens ?? 0;
      llmCostByOperation[key].outputTokens += cost.output_tokens ?? 0;
    }

    // Aggregate LLM by model (for per-model breakdown with tokens)
    const llmCostByModel: Record<
      string,
      {
        provider: string;
        count: number;
        totalCost: number;
        inputTokens: number;
        outputTokens: number;
      }
    > = {};
    for (const cost of allLlmCosts) {
      const key = cost.model;
      if (!llmCostByModel[key])
        llmCostByModel[key] = {
          provider: cost.provider,
          count: 0,
          totalCost: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      llmCostByModel[key].count++;
      llmCostByModel[key].totalCost += cost.cost_usd ?? 0;
      llmCostByModel[key].inputTokens += cost.input_tokens ?? 0;
      llmCostByModel[key].outputTokens += cost.output_tokens ?? 0;
    }

    // Aggregate LLM by provider
    const llmCostByProvider: Record<
      string,
      { count: number; totalCost: number }
    > = {};
    for (const cost of allLlmCosts) {
      const key = cost.provider;
      if (!llmCostByProvider[key])
        llmCostByProvider[key] = { count: 0, totalCost: 0 };
      llmCostByProvider[key].count++;
      llmCostByProvider[key].totalCost += cost.cost_usd ?? 0;
    }

    // Cost by campaign
    const costByCampaign: Record<
      string,
      {
        name: string;
        apifyCost: number;
        llmCost: number;
        totalCost: number;
        leadCount: number;
      }
    > = {};
    for (const run of allRuns) {
      const cId = run.campaign_id ?? "unknown";
      if (!costByCampaign[cId])
        costByCampaign[cId] = {
          name: campaignNames[cId] || "Unknown",
          apifyCost: 0,
          llmCost: 0,
          totalCost: 0,
          leadCount: leadCountByCampaign[cId] || 0,
        };
      costByCampaign[cId].apifyCost += run.cost_usd ?? 0;
      costByCampaign[cId].totalCost += run.cost_usd ?? 0;
    }
    for (const cost of allLlmCosts) {
      const cId = cost.campaign_id ?? "unknown";
      if (!costByCampaign[cId])
        costByCampaign[cId] = {
          name: campaignNames[cId] || "Unknown",
          apifyCost: 0,
          llmCost: 0,
          totalCost: 0,
          leadCount: leadCountByCampaign[cId] || 0,
        };
      costByCampaign[cId].llmCost += cost.cost_usd ?? 0;
      costByCampaign[cId].totalCost += cost.cost_usd ?? 0;
    }

    // Round all campaign costs
    for (const cId in costByCampaign) {
      costByCampaign[cId].apifyCost =
        Math.round(costByCampaign[cId].apifyCost * 10000) / 10000;
      costByCampaign[cId].llmCost =
        Math.round(costByCampaign[cId].llmCost * 10000) / 10000;
      costByCampaign[cId].totalCost =
        Math.round(costByCampaign[cId].totalCost * 10000) / 10000;
    }

    const totalApify = allRuns.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
    const totalLlm = allLlmCosts.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
    const grandTotal = totalApify + totalLlm;

    // Recent runs (last 20)
    const recentRuns = allRuns.slice(0, 20).map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      status: r.status,
      resultCount: r.result_count ?? 0,
      costUsd: Math.round((r.cost_usd ?? 0) * 10000) / 10000,
      startedAt: r.started_at,
      campaignName: campaignNames[r.campaign_id] || "Unknown",
    }));

    return NextResponse.json({
      data: {
        apifyCostByActor,
        llmCostByOperation,
        llmCostByModel,
        llmCostByProvider,
        totalApifyCost: Math.round(totalApify * 10000) / 10000,
        totalLlmCost: Math.round(totalLlm * 10000) / 10000,
        totalCost: Math.round(grandTotal * 10000) / 10000,
        totalRuns: allRuns.length,
        totalLlmCalls: allLlmCosts.length,
        costByCampaign,
        recentRuns,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
