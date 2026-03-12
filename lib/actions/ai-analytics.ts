"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, logTokenUsage } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { MODEL_MAP } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";

/**
 * Parse a JSON response from the AI, handling markdown code block wrappers.
 */
function parseJSON<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PipelineAnalysis {
  summary: string;
  insights: string[];
  risks: Array<{ deal_name: string; risk: string; mitigation: string }>;
  opportunities: string[];
}

interface ForecastResult {
  forecast_30d: number;
  forecast_60d: number;
  forecast_90d: number;
  confidence: number;
  assumptions: string[];
  factors: Array<{ factor: string; impact: string }>;
}

interface RiskAnalysis {
  at_risk_deals: Array<{
    deal_name: string;
    value: number;
    risk_factors: string[];
    recommended_actions: string[];
  }>;
  summary: string;
}

interface InsightsSummary {
  executive_summary: string;
  key_metrics: Array<{ metric: string; value: string; trend: string }>;
  action_items: Array<{ action: string; priority: string; impact: string }>;
  health_score: number;
}

// ─── aiAnalyzePipeline ───────────────────────────────────────────────────────

/**
 * Analyze the active deals pipeline with AI to identify insights, risks, and opportunities.
 * Excludes deals in "closed_won" or "closed_lost" stages.
 */
export async function aiAnalyzePipeline(): Promise<
  PipelineAnalysis | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_analytics) {
      return { error: "AI analytics feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch active deals (not won or lost)
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, contact_name, contact_email, notes, days_in_stage, organization_id"
      )
      .eq("organization_id", orgId)
      .not("stage", "in", '("closed_won","closed_lost")')
      .order("value", { ascending: false });

    if (dealsError) {
      return { error: `Failed to fetch deals: ${dealsError.message}` };
    }

    // Fetch customers for context
    const { data: customers } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, company, status, plan, mrr, health_score"
      )
      .eq("organization_id", orgId)
      .limit(50);

    // Build the prompt
    const sections: string[] = [];

    if (deals && deals.length > 0) {
      const dealLines = deals
        .map(
          (d) =>
            `- ${d.name}: $${d.value || 0} | Stage: ${d.stage} | Probability: ${d.probability || "N/A"}% | Close: ${d.close_date || "N/A"} | Days in Stage: ${d.days_in_stage || "N/A"} | Contact: ${d.contact_name || "N/A"}`
        )
        .join("\n");
      sections.push(`## Active Pipeline (${deals.length} deals)\n${dealLines}`);

      const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
      const weightedValue = deals.reduce(
        (sum, d) => sum + (d.value || 0) * ((d.probability || 0) / 100),
        0
      );
      sections.push(`## Pipeline Summary
- Total Pipeline Value: $${totalValue.toLocaleString()}
- Weighted Pipeline Value: $${Math.round(weightedValue).toLocaleString()}
- Average Deal Size: $${Math.round(totalValue / deals.length).toLocaleString()}
- Deal Count: ${deals.length}`);
    } else {
      sections.push("## Pipeline\nNo active deals in the pipeline.");
    }

    if (customers && customers.length > 0) {
      const totalMRR = customers.reduce((sum, c) => sum + (c.mrr || 0), 0);
      const avgHealth =
        customers.reduce((sum, c) => sum + (c.health_score || 0), 0) /
        customers.length;
      sections.push(`## Customer Base
- Total Customers: ${customers.length}
- Total MRR: $${totalMRR.toLocaleString()}
- Average Health Score: ${Math.round(avgHealth)}/100`);
    }

    sections.push(`
Analyze the pipeline data and return a JSON object with:
- summary: string (executive summary of pipeline health, 2-3 sentences)
- insights: string[] (5-7 key insights about the pipeline)
- risks: Array of { deal_name: string, risk: string, mitigation: string } (identify at-risk deals)
- opportunities: string[] (3-5 opportunities for improvement)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.analytics_insights,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: PipelineAnalysis;
    try {
      parsed = parseJSON<PipelineAnalysis>(text);
    } catch {
      return { error: "Failed to parse AI pipeline analysis response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "analytics",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { dealCount: deals?.length || 0, function: "aiAnalyzePipeline" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI pipeline analysis failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "analytics",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { function: "aiAnalyzePipeline" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiPredictForecast ───────────────────────────────────────────────────────

/**
 * Generate revenue forecasts for 30/60/90 day horizons based on current pipeline.
 */
export async function aiPredictForecast(): Promise<
  ForecastResult | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_analytics) {
      return { error: "AI analytics feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch all deals with stages, values, probabilities, close_dates
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, days_in_stage, organization_id"
      )
      .eq("organization_id", orgId)
      .not("stage", "in", '("closed_won","closed_lost")')
      .order("close_date", { ascending: true });

    if (dealsError) {
      return { error: `Failed to fetch deals: ${dealsError.message}` };
    }

    // Also fetch recently won/lost for historical context
    const { data: closedDeals } = await supabase
      .from("deals")
      .select("id, name, value, stage, probability, close_date, days_in_stage")
      .eq("organization_id", orgId)
      .in("stage", ["closed_won", "closed_lost"])
      .order("close_date", { ascending: false })
      .limit(20);

    const sections: string[] = [];

    const now = new Date();
    const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    sections.push(`## Forecast Parameters
- Current Date: ${now.toISOString().split("T")[0]}
- 30-Day Window: ${now.toISOString().split("T")[0]} to ${d30.toISOString().split("T")[0]}
- 60-Day Window: ${now.toISOString().split("T")[0]} to ${d60.toISOString().split("T")[0]}
- 90-Day Window: ${now.toISOString().split("T")[0]} to ${d90.toISOString().split("T")[0]}`);

    if (deals && deals.length > 0) {
      const dealLines = deals
        .map(
          (d) =>
            `- ${d.name}: $${d.value || 0} | Stage: ${d.stage} | Probability: ${d.probability || 0}% | Close: ${d.close_date || "N/A"} | Days in Stage: ${d.days_in_stage || "N/A"}`
        )
        .join("\n");
      sections.push(`## Active Deals (${deals.length})\n${dealLines}`);
    } else {
      sections.push("## Active Deals\nNo active deals in the pipeline.");
    }

    if (closedDeals && closedDeals.length > 0) {
      const wonDeals = closedDeals.filter((d) => d.stage === "closed_won");
      const lostDeals = closedDeals.filter((d) => d.stage === "closed_lost");
      const winRate =
        closedDeals.length > 0
          ? Math.round((wonDeals.length / closedDeals.length) * 100)
          : 0;
      const avgWonValue =
        wonDeals.length > 0
          ? Math.round(
              wonDeals.reduce((sum, d) => sum + (d.value || 0), 0) /
                wonDeals.length
            )
          : 0;

      sections.push(`## Historical Context (Recent Closed Deals)
- Won: ${wonDeals.length} deals
- Lost: ${lostDeals.length} deals
- Win Rate: ${winRate}%
- Average Won Deal Value: $${avgWonValue.toLocaleString()}`);
    }

    sections.push(`
Generate a revenue forecast. Return a JSON object with:
- forecast_30d: number (projected revenue in dollars for next 30 days)
- forecast_60d: number (projected revenue in dollars for next 60 days)
- forecast_90d: number (projected revenue in dollars for next 90 days)
- confidence: number (0-100 confidence score in the forecast)
- assumptions: string[] (3-5 key assumptions underlying the forecast)
- factors: Array of { factor: string, impact: string } (key factors affecting the forecast, with "positive", "negative", or "neutral" impact)

Use deal probabilities, close dates, historical win rates, and stage progression to calculate forecasts.
Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 1536,
      system: SYSTEM_PROMPTS.forecast,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: ForecastResult;
    try {
      parsed = parseJSON<ForecastResult>(text);
    } catch {
      return { error: "Failed to parse AI forecast response" };
    }

    // Ensure numeric values
    parsed.forecast_30d = Number(parsed.forecast_30d) || 0;
    parsed.forecast_60d = Number(parsed.forecast_60d) || 0;
    parsed.forecast_90d = Number(parsed.forecast_90d) || 0;
    parsed.confidence = Math.min(
      100,
      Math.max(0, Number(parsed.confidence) || 0)
    );

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "analytics",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { dealCount: deals?.length || 0, function: "aiPredictForecast" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI forecast prediction failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "analytics",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { function: "aiPredictForecast" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiIdentifyRisks ─────────────────────────────────────────────────────────

/**
 * Identify deals at risk based on stale stages, lack of activity, and other signals.
 * Uses Claude Haiku for fast pattern matching.
 */
export async function aiIdentifyRisks(): Promise<
  RiskAnalysis | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_analytics) {
      return { error: "AI analytics feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch active deals with days_in_stage
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, days_in_stage, contact_name, notes, organization_id"
      )
      .eq("organization_id", orgId)
      .not("stage", "in", '("closed_won","closed_lost")')
      .order("value", { ascending: false });

    if (dealsError) {
      return { error: `Failed to fetch deals: ${dealsError.message}` };
    }

    // Fetch recent deal activities (deal_activities table has deal_id)
    const { data: dealActivities } = await supabase
      .from("deal_activities")
      .select("id, deal_id, type, title, description, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    // Build activity map per deal
    const activityByDeal: Record<string, Array<Record<string, unknown>>> = {};
    if (dealActivities) {
      for (const a of dealActivities) {
        if (a.deal_id) {
          if (!activityByDeal[a.deal_id]) activityByDeal[a.deal_id] = [];
          activityByDeal[a.deal_id].push(a);
        }
      }
    }

    const sections: string[] = [];

    if (deals && deals.length > 0) {
      const dealLines = deals
        .map((d) => {
          const dealActivities = activityByDeal[d.id] || [];
          const lastActivity =
            dealActivities.length > 0
              ? (dealActivities[0].created_at as string)
              : "No activities";
          return `- ${d.name}: $${d.value || 0} | Stage: ${d.stage} | Probability: ${d.probability || "N/A"}% | Close: ${d.close_date || "N/A"} | Days in Stage: ${d.days_in_stage || "N/A"} | Last Activity: ${lastActivity} | Activities Count: ${dealActivities.length}`;
        })
        .join("\n");
      sections.push(`## Active Deals (${deals.length})\n${dealLines}`);
    } else {
      sections.push("## Active Deals\nNo active deals to analyze.");
    }

    sections.push(`
Identify deals at risk. Consider these risk signals:
- Deals stuck in a stage for too long (high days_in_stage)
- Deals with close dates in the past or very soon with low probability
- Deals with no recent activities
- Deals with declining probability or missing contact information

Return a JSON object with:
- at_risk_deals: Array of { deal_name: string, value: number, risk_factors: string[], recommended_actions: string[] }
- summary: string (overall risk assessment summary, 2-3 sentences)

Only include deals that have genuine risk indicators. Order by severity.
Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: MODEL_MAP.haiku,
      max_tokens: 1536,
      system:
        "You are a sales risk analyst. Identify deals at risk based on pipeline data, activity patterns, and stage progression. Be specific about risk factors and provide actionable recommendations. Return ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: RiskAnalysis;
    try {
      parsed = parseJSON<RiskAnalysis>(text);
    } catch {
      return { error: "Failed to parse AI risk analysis response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "analytics",
      model: MODEL_MAP.haiku,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { dealCount: deals?.length || 0, function: "aiIdentifyRisks" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI risk identification failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "analytics",
        model: MODEL_MAP.haiku,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { function: "aiIdentifyRisks" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ─── aiGenerateInsightsSummary ───────────────────────────────────────────────

/**
 * Generate an executive insights summary across the entire organization:
 * leads, deals, customers, pipeline health, and action items.
 */
export async function aiGenerateInsightsSummary(): Promise<
  InsightsSummary | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_analytics) {
      return { error: "AI analytics feature is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch leads summary
    const { data: leads } = await supabase
      .from("leads")
      .select("id, status, score, estimated_value, source")
      .eq("organization_id", orgId);

    // Fetch deals summary
    const { data: deals } = await supabase
      .from("deals")
      .select("id, name, value, stage, probability, close_date, days_in_stage")
      .eq("organization_id", orgId);

    // Fetch customers summary
    const { data: customers } = await supabase
      .from("customers")
      .select("id, status, plan, mrr, health_score")
      .eq("organization_id", orgId);

    // Build the prompt with aggregated data
    const sections: string[] = [];

    // Leads metrics
    if (leads && leads.length > 0) {
      const statusCounts: Record<string, number> = {};
      let totalEstimatedValue = 0;
      let avgScore = 0;
      let scoredCount = 0;

      for (const l of leads) {
        statusCounts[l.status || "unknown"] =
          (statusCounts[l.status || "unknown"] || 0) + 1;
        totalEstimatedValue += l.estimated_value || 0;
        if (l.score != null) {
          avgScore += l.score;
          scoredCount++;
        }
      }

      const statusLines = Object.entries(statusCounts)
        .map(([status, count]) => `  - ${status}: ${count}`)
        .join("\n");

      sections.push(`## Leads Overview (${leads.length} total)
${statusLines}
- Total Estimated Value: $${totalEstimatedValue.toLocaleString()}
- Average Score: ${scoredCount > 0 ? Math.round(avgScore / scoredCount) : "N/A"} (${scoredCount} scored)`);
    } else {
      sections.push("## Leads Overview\nNo leads in the system.");
    }

    // Deals / Pipeline metrics
    if (deals && deals.length > 0) {
      const activeDeals = deals.filter(
        (d) => d.stage !== "closed_won" && d.stage !== "closed_lost"
      );
      const wonDeals = deals.filter((d) => d.stage === "closed_won");
      const lostDeals = deals.filter((d) => d.stage === "closed_lost");

      const pipelineValue = activeDeals.reduce(
        (sum, d) => sum + (d.value || 0),
        0
      );
      const weightedPipeline = activeDeals.reduce(
        (sum, d) => sum + (d.value || 0) * ((d.probability || 0) / 100),
        0
      );
      const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const winRate =
        wonDeals.length + lostDeals.length > 0
          ? Math.round(
              (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
            )
          : 0;

      const stageCounts: Record<string, number> = {};
      for (const d of activeDeals) {
        stageCounts[d.stage || "unknown"] =
          (stageCounts[d.stage || "unknown"] || 0) + 1;
      }
      const stageLines = Object.entries(stageCounts)
        .map(([stage, count]) => `  - ${stage}: ${count}`)
        .join("\n");

      sections.push(`## Pipeline Overview (${deals.length} total deals)
- Active Deals: ${activeDeals.length}
${stageLines}
- Pipeline Value: $${pipelineValue.toLocaleString()}
- Weighted Pipeline: $${Math.round(weightedPipeline).toLocaleString()}
- Won Deals: ${wonDeals.length} ($${wonValue.toLocaleString()})
- Lost Deals: ${lostDeals.length}
- Win Rate: ${winRate}%`);
    } else {
      sections.push("## Pipeline Overview\nNo deals in the system.");
    }

    // Customers metrics
    if (customers && customers.length > 0) {
      const totalMRR = customers.reduce((sum, c) => sum + (c.mrr || 0), 0);
      const avgHealth =
        customers.reduce((sum, c) => sum + (c.health_score || 0), 0) /
        customers.length;
      const planCounts: Record<string, number> = {};
      for (const c of customers) {
        planCounts[c.plan || "unknown"] =
          (planCounts[c.plan || "unknown"] || 0) + 1;
      }
      const planLines = Object.entries(planCounts)
        .map(([plan, count]) => `  - ${plan}: ${count}`)
        .join("\n");

      sections.push(`## Customer Base (${customers.length} total)
${planLines}
- Total MRR: $${totalMRR.toLocaleString()}
- Average Health Score: ${Math.round(avgHealth)}/100`);
    } else {
      sections.push("## Customer Base\nNo customers in the system.");
    }

    sections.push(`
Generate a comprehensive executive insights summary. Return a JSON object with:
- executive_summary: string (3-4 sentence executive summary of overall business health)
- key_metrics: Array of { metric: string, value: string, trend: string } (6-8 key metrics with trend as "up", "down", or "stable")
- action_items: Array of { action: string, priority: string, impact: string } (5-7 prioritized action items, priority as "high", "medium", or "low", impact as "high", "medium", or "low")
- health_score: number (0-100 overall business health score)

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.analytics_insights,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: InsightsSummary;
    try {
      parsed = parseJSON<InsightsSummary>(text);
    } catch {
      return { error: "Failed to parse AI insights summary response" };
    }

    // Ensure health_score is valid
    parsed.health_score = Math.min(
      100,
      Math.max(0, Math.round(Number(parsed.health_score) || 0))
    );

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "analytics",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: {
        leadCount: leads?.length || 0,
        dealCount: deals?.length || 0,
        customerCount: customers?.length || 0,
        function: "aiGenerateInsightsSummary",
      },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : "AI insights summary generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "analytics",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { function: "aiGenerateInsightsSummary" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
