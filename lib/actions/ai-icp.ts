"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, logTokenUsage } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { MODEL_MAP } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";

// ── JSON Parser ──────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T {
  // Try to extract from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DimensionScore {
  score: number;
  explanation: string;
}

interface ICPMatchResult {
  match_score: number;
  dimension_scores: Record<string, DimensionScore>;
  overall_assessment: string;
  recommendations: string[];
}

interface SuggestedICPProfile {
  suggested_profile: Record<string, unknown>;
  reasoning: string;
}

// ── aiMatchLead ──────────────────────────────────────────────────────────────

/**
 * AI-powered ICP matching for a single lead.
 * Compares lead data against the default (primary) ICP profile
 * and returns dimension-level scores with explanations.
 */
export async function aiMatchLead(
  leadId: string
): Promise<ICPMatchResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_icp_matching) {
      return { error: "AI ICP matching is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, company, website, linkedin, source, status, score, estimated_value, industry, employees, win_probability, qualification_data, location, organization_id"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    // Fetch the primary ICP profile for the organization
    const { data: icpProfile, error: icpError } = await supabase
      .from("icp_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_primary", true)
      .single();

    if (icpError || !icpProfile) {
      return {
        error:
          "No default ICP profile found. Please create an ICP profile and mark it as primary.",
      };
    }

    // Build the prompt
    const prompt = `## Lead Data
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Location: ${lead.location || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}
- Current Score: ${lead.score ?? "Not scored"}
${lead.qualification_data ? `- Qualification Data: ${JSON.stringify(lead.qualification_data)}` : ""}

## ICP Profile: ${icpProfile.name}
${icpProfile.description ? `Description: ${icpProfile.description}` : ""}
- Criteria: ${JSON.stringify(icpProfile.criteria)}
- Weights: ${JSON.stringify(icpProfile.weights)}
- Buyer Personas: ${JSON.stringify(icpProfile.buyer_personas)}

Please analyze how well this lead matches the ICP profile. Return a JSON object with:
- match_score: number (0-100, overall match percentage)
- dimension_scores: an object with keys "industry", "company_size", "budget", "geography", "technology", "pain_points" — each having { score: number (0-100), explanation: string }
- overall_assessment: string (2-3 sentence summary of the match quality)
- recommendations: string[] (3-5 actionable recommendations to improve the match or approach this lead)

Return ONLY valid JSON.`;

    // Call Claude Haiku
    const response = await client.messages.create({
      model: MODEL_MAP.haiku,
      max_tokens: 1024,
      system: SYSTEM_PROMPTS.icp_matching,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse AI response
    let parsed: {
      match_score: number;
      dimension_scores: Record<string, DimensionScore>;
      overall_assessment: string;
      recommendations: string[];
    };

    try {
      parsed = parseJSON(text);
    } catch {
      return { error: "Failed to parse AI ICP matching response" };
    }

    // Validate and clamp match_score
    if (typeof parsed.match_score !== "number") {
      return { error: "Invalid match_score returned from AI" };
    }

    const matchScore = Math.round(
      Math.min(100, Math.max(0, parsed.match_score))
    );

    // Clamp dimension scores
    const dimensionScores: Record<string, DimensionScore> = {};
    const expectedDimensions = [
      "industry",
      "company_size",
      "budget",
      "geography",
      "technology",
      "pain_points",
    ];
    for (const dim of expectedDimensions) {
      const rawDim = parsed.dimension_scores?.[dim];
      dimensionScores[dim] = {
        score: Math.round(
          Math.min(100, Math.max(0, rawDim?.score ?? 50))
        ),
        explanation: rawDim?.explanation || "No data available for assessment.",
      };
    }

    const result: ICPMatchResult = {
      match_score: matchScore,
      dimension_scores: dimensionScores,
      overall_assessment: parsed.overall_assessment || "",
      recommendations: parsed.recommendations || [],
    };

    const durationMs = Date.now() - startTime;

    // Log token usage
    await logTokenUsage({
      orgId,
      userId,
      feature: "icp_matching",
      model: MODEL_MAP.haiku,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { leadId, match_score: matchScore },
    });

    // Revalidate relevant pages
    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${leadId}`);
    revalidatePath("/dashboard/icp");

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI ICP matching failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "icp_matching",
        model: MODEL_MAP.haiku,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { leadId },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ── aiGenerateICPProfile ─────────────────────────────────────────────────────

/**
 * AI-powered ICP profile generation.
 * Analyzes won deals and their associated customers to identify
 * patterns and suggest an ideal customer profile.
 */
export async function aiGenerateICPProfile(): Promise<
  SuggestedICPProfile | { error: string }
> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_icp_matching) {
      return { error: "AI ICP matching is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch all won deals for the organization
    const { data: wonDeals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, name, company, value, probability, close_date, customer_id, contact_name, contact_email, notes, days_to_close"
      )
      .eq("organization_id", orgId)
      .eq("stage", "closed_won")
      .order("close_date", { ascending: false })
      .limit(50);

    if (dealsError || !wonDeals || wonDeals.length === 0) {
      return {
        error:
          "No won deals found. At least a few closed-won deals are needed to generate an ICP profile.",
      };
    }

    // Collect customer_ids from won deals for separate customer query
    const customerIds = wonDeals
      .map((d) => d.customer_id)
      .filter((id): id is string => id !== null);

    let customers: Array<Record<string, unknown>> = [];
    if (customerIds.length > 0) {
      const { data: customerData } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, email, company, industry, company_size, job_title, plan, mrr, health_score, lifetime_value"
        )
        .in("id", customerIds);

      customers = (customerData as Array<Record<string, unknown>>) || [];
    }

    // Build customer map for quick lookup
    const customerMap = new Map(
      customers.map((c) => [c.id as string, c])
    );

    // Build combined deal + customer data for analysis
    const dealSummaries = wonDeals.map((deal) => {
      const customer = deal.customer_id
        ? customerMap.get(deal.customer_id)
        : null;
      return {
        deal_name: deal.name,
        company: deal.company || (customer?.company as string) || "Unknown",
        deal_value: deal.value,
        days_to_close: deal.days_to_close,
        close_date: deal.close_date,
        contact_name: deal.contact_name,
        customer_industry: (customer?.industry as string) || "Unknown",
        customer_company_size: (customer?.company_size as string) || "Unknown",
        customer_plan: (customer?.plan as string) || "Unknown",
        customer_mrr: (customer?.mrr as number) || 0,
        customer_health_score: (customer?.health_score as number) || 0,
        customer_lifetime_value: (customer?.lifetime_value as number) || 0,
        customer_job_title: (customer?.job_title as string) || "Unknown",
      };
    });

    // Build the prompt
    const prompt = `## Won Deals & Customer Data (${dealSummaries.length} deals)

${JSON.stringify(dealSummaries, null, 2)}

## Task
Analyze the patterns across these won deals and associated customers. Identify the common characteristics that define our ideal customer.

Return a JSON object with:
- suggested_profile: an object containing:
  - name: string (a suggested ICP profile name)
  - description: string (brief description of the ideal customer)
  - firmographic: { industries: string[], company_sizes: string[], geography: string[] }
  - financial: { avg_deal_value: number, deal_value_range: { min: number, max: number }, avg_mrr: number, budget_range: string }
  - behavioral: { avg_days_to_close: number, common_plans: string[], buying_patterns: string[] }
  - pain_points: string[] (inferred common pain points)
  - technology: string[] (inferred technology stack patterns)
  - buyer_persona: { common_titles: string[], decision_criteria: string[] }
- reasoning: string (detailed explanation of the patterns found and why this profile is recommended, 3-5 sentences)

Return ONLY valid JSON.`;

    // Call Claude Sonnet (more complex analytical task)
    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: `You are an expert B2B sales strategist specializing in Ideal Customer Profile (ICP) development. Analyze patterns in won deals and customer data to identify the characteristics of the most successful customers. Be data-driven and specific in your analysis.`,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse AI response
    let parsed: {
      suggested_profile: Record<string, unknown>;
      reasoning: string;
    };

    try {
      parsed = parseJSON(text);
    } catch {
      return { error: "Failed to parse AI ICP generation response" };
    }

    if (!parsed.suggested_profile || typeof parsed.suggested_profile !== "object") {
      return { error: "Invalid ICP profile structure returned from AI" };
    }

    const result: SuggestedICPProfile = {
      suggested_profile: parsed.suggested_profile,
      reasoning: parsed.reasoning || "",
    };

    const durationMs = Date.now() - startTime;

    // Log token usage
    await logTokenUsage({
      orgId,
      userId,
      feature: "icp_matching",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { wonDealsCount: wonDeals.length, customersCount: customers.length },
    });

    // Revalidate ICP page
    revalidatePath("/dashboard/icp");

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI ICP profile generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "icp_matching",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
