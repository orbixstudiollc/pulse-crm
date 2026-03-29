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

    // Apify run costs
    let runsQuery = supabase
      .from("lf_apify_runs")
      .select("id, actor_id, campaign_id, cost_usd, started_at, status")
      .eq("organization_id", orgId);
    if (campaignId) runsQuery = runsQuery.eq("campaign_id", campaignId);
    const { data: runs } = await runsQuery;

    // LLM costs
    let llmQuery = supabase
      .from("lf_llm_costs")
      .select("id, provider, model, operation, input_tokens, output_tokens, cost_usd, campaign_id, created_at")
      .eq("organization_id", orgId);
    if (campaignId) llmQuery = llmQuery.eq("campaign_id", campaignId);
    const { data: llmCosts } = await llmQuery;

    const allRuns = runs ?? [];
    const allLlmCosts = llmCosts ?? [];

    // Aggregate by actor
    const apifyCostByActor: Record<string, { count: number; totalCost: number }> = {};
    for (const run of allRuns) {
      const key = run.actor_id;
      if (!apifyCostByActor[key]) {
        apifyCostByActor[key] = { count: 0, totalCost: 0 };
      }
      apifyCostByActor[key].count++;
      apifyCostByActor[key].totalCost += run.cost_usd ?? 0;
    }

    // Aggregate LLM by operation
    const llmCostByOperation: Record<string, { count: number; totalCost: number; inputTokens: number; outputTokens: number }> = {};
    for (const cost of allLlmCosts) {
      const key = cost.operation;
      if (!llmCostByOperation[key]) {
        llmCostByOperation[key] = { count: 0, totalCost: 0, inputTokens: 0, outputTokens: 0 };
      }
      llmCostByOperation[key].count++;
      llmCostByOperation[key].totalCost += cost.cost_usd ?? 0;
      llmCostByOperation[key].inputTokens += cost.input_tokens ?? 0;
      llmCostByOperation[key].outputTokens += cost.output_tokens ?? 0;
    }

    // Totals
    const totalApify = allRuns.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
    const totalLlm = allLlmCosts.reduce((s, c) => s + (c.cost_usd ?? 0), 0);

    return NextResponse.json({
      data: {
        apify: {
          totalCost: Math.round(totalApify * 10000) / 10000,
          totalRuns: allRuns.length,
          byActor: apifyCostByActor,
        },
        llm: {
          totalCost: Math.round(totalLlm * 10000) / 10000,
          totalCalls: allLlmCosts.length,
          byOperation: llmCostByOperation,
        },
        grandTotal: Math.round((totalApify + totalLlm) * 10000) / 10000,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
