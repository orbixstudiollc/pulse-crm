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
  return JSON.parse(jsonStr);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingTier {
  tier: string;
  price: string;
  features: string[];
}

interface ProposalResult {
  title: string;
  executive_summary: string;
  problem_statement: string;
  proposed_solution: string;
  deliverables: string[];
  timeline: string;
  pricing: PricingTier[];
  next_steps: string[];
  terms: string;
}

interface PricingTierResult {
  name: string;
  price: string;
  features: string[];
  recommended: boolean;
}

interface PricingResult {
  tiers: PricingTierResult[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// 1. aiGenerateProposal
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive sales proposal for a deal using Claude Sonnet.
 * Fetches deal, customer (if linked), and competitor data for full context.
 */
export async function aiGenerateProposal(
  dealId: string
): Promise<ProposalResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_proposals) {
      return { error: "AI proposals is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch deal data
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, customer_id, contact_name, contact_email, notes, organization_id, days_in_stage, created_at, updated_at"
      )
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return { error: `Deal not found: ${dealError?.message || "Unknown error"}` };
    }

    // Fetch customer if linked
    let customer: Record<string, unknown> | null = null;
    if (deal.customer_id) {
      const { data: customerData } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, company, email, phone, status, plan, mrr, health_score"
        )
        .eq("id", deal.customer_id)
        .single();

      customer = customerData;
    }

    // Fetch competitors for the organization
    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name, website, category, description, strengths, weaknesses, pricing")
      .eq("organization_id", orgId)
      .limit(10);

    // Build prompt
    const sections: string[] = [];

    sections.push(`## Deal Information
- Deal Name: ${deal.name || "N/A"}
- Value: ${deal.value ? `$${deal.value}` : "N/A"}
- Stage: ${deal.stage || "N/A"}
- Probability: ${deal.probability ? `${deal.probability}%` : "N/A"}
- Close Date: ${deal.close_date || "N/A"}
- Contact Name: ${deal.contact_name || "N/A"}
- Contact Email: ${deal.contact_email || "N/A"}
- Days in Stage: ${deal.days_in_stage ?? "N/A"}
- Notes: ${deal.notes || "None"}`);

    if (customer) {
      const customerName = [customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ");
      sections.push(`## Customer Information
- Name: ${customerName || "N/A"}
- Company: ${customer.company || "N/A"}
- Email: ${customer.email || "N/A"}
- Phone: ${customer.phone || "N/A"}
- Status: ${customer.status || "N/A"}
- Current Plan: ${customer.plan || "N/A"}
- MRR: ${customer.mrr ? `$${customer.mrr}` : "N/A"}
- Health Score: ${customer.health_score ?? "N/A"}`);
    }

    if (competitors && competitors.length > 0) {
      const competitorLines = competitors
        .map(
          (c) =>
            `- ${c.name} (${c.category || "N/A"}): Strengths: ${(c.strengths || []).join(", ") || "N/A"} | Weaknesses: ${(c.weaknesses || []).join(", ") || "N/A"}`
        )
        .join("\n");
      sections.push(`## Known Competitors\n${competitorLines}`);
    }

    sections.push(`
Please generate a comprehensive sales proposal. Return a JSON object with:
- title: string (proposal title)
- executive_summary: string (2-3 paragraphs summarizing the proposal)
- problem_statement: string (customer pain points and challenges)
- proposed_solution: string (how we solve their problems)
- deliverables: string[] (list of concrete deliverables)
- timeline: string (implementation timeline with milestones)
- pricing: Array of objects with { tier: string, price: string, features: string[] } (3 pricing tiers: Good/Better/Best)
- next_steps: string[] (3-5 concrete next steps to move forward)
- terms: string (standard terms and conditions summary)

Make the proposal specific to the customer's situation. If competitors are listed, position against them.

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Sonnet
    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.proposal,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: ProposalResult;
    try {
      parsed = parseJSON<ProposalResult>(text);
    } catch {
      return { error: "Failed to parse AI proposal response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "proposals",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { dealId, type: "proposal" },
    });

    revalidatePath("/dashboard/proposals");

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI proposal generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "proposals",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { dealId, type: "proposal" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 2. aiGeneratePricingTiers
// ---------------------------------------------------------------------------

/**
 * Generate Good/Better/Best pricing tiers for a deal using Claude Sonnet.
 * Fetches deal and customer info for context.
 */
export async function aiGeneratePricingTiers(
  dealId: string
): Promise<PricingResult | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    if (!settings.feature_proposals) {
      return { error: "AI proposals is disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch deal data
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select(
        "id, name, value, stage, probability, close_date, customer_id, contact_name, contact_email, notes, organization_id, days_in_stage"
      )
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return { error: `Deal not found: ${dealError?.message || "Unknown error"}` };
    }

    // Fetch customer if linked
    let customer: Record<string, unknown> | null = null;
    if (deal.customer_id) {
      const { data: customerData } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, company, email, phone, status, plan, mrr, health_score"
        )
        .eq("id", deal.customer_id)
        .single();

      customer = customerData;
    }

    // Build prompt
    const sections: string[] = [];

    sections.push(`## Deal Information
- Deal Name: ${deal.name || "N/A"}
- Value: ${deal.value ? `$${deal.value}` : "N/A"}
- Stage: ${deal.stage || "N/A"}
- Probability: ${deal.probability ? `${deal.probability}%` : "N/A"}
- Close Date: ${deal.close_date || "N/A"}
- Contact Name: ${deal.contact_name || "N/A"}
- Notes: ${deal.notes || "None"}`);

    if (customer) {
      const customerName = [customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ");
      sections.push(`## Customer Information
- Name: ${customerName || "N/A"}
- Company: ${customer.company || "N/A"}
- Status: ${customer.status || "N/A"}
- Current Plan: ${customer.plan || "N/A"}
- MRR: ${customer.mrr ? `$${customer.mrr}` : "N/A"}
- Health Score: ${customer.health_score ?? "N/A"}`);
    }

    sections.push(`
Please generate Good/Better/Best pricing tiers for this deal. Return a JSON object with:
- tiers: Array of 3 objects, each with:
  - name: string (tier name, e.g. "Starter", "Professional", "Enterprise")
  - price: string (price with currency, e.g. "$499/mo")
  - features: string[] (list of features included in this tier)
  - recommended: boolean (true for the tier you recommend for this customer, only one should be true)
- reasoning: string (explanation of why these tiers and pricing are appropriate for this customer, and why the recommended tier is the best fit)

Base pricing around the deal value. The recommended tier should align with the customer's needs and budget.

Return ONLY valid JSON.`);

    const prompt = sections.join("\n\n");

    // Call Claude Sonnet
    const response = await client.messages.create({
      model: MODEL_MAP.sonnet,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.proposal,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: PricingResult;
    try {
      parsed = parseJSON<PricingResult>(text);
    } catch {
      return { error: "Failed to parse AI pricing tiers response" };
    }

    const durationMs = Date.now() - startTime;

    await logTokenUsage({
      orgId,
      userId,
      feature: "proposals",
      model: MODEL_MAP.sonnet,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
      metadata: { dealId, type: "pricing_tiers" },
    });

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "AI pricing tier generation failed";

    try {
      const { orgId, userId } = await getAIClient();
      await logTokenUsage({
        orgId,
        userId,
        feature: "proposals",
        model: MODEL_MAP.sonnet,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        success: false,
        errorMessage,
        metadata: { dealId, type: "pricing_tiers" },
      });
    } catch {
      // Silently fail if we can't log the error usage
    }

    return { error: errorMessage };
  }
}
