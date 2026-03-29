import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { runActorAndCollect } from "../apify/runner";
import { getActorById } from "../apify/registry-server";
import { coerceActorInput } from "../apify/coerce-input";
import { generateCompletion, logLlmCost } from "../ai-provider";
import { leadEmitter } from "../events/emitter";
import type {
  AIProvider,
  LFCampaign,
  LFLead,
  KpiDefinition,
} from "../types";

// =============================================================================
// Enrichment Pipeline – enriches discovered leads with website/social data + AI
// =============================================================================

// Cancellation tokens per campaign
const activeCancellations = new Map<string, boolean>();

export function cancelEnrichment(campaignId: string): void {
  activeCancellations.set(campaignId, true);
}

function isCancelled(campaignId: string): boolean {
  return activeCancellations.get(campaignId) === true;
}

function clearCancellation(campaignId: string): void {
  activeCancellations.delete(campaignId);
}

// ---------------------------------------------------------------------------
// Enrich a single lead
// ---------------------------------------------------------------------------

export async function enrichSingleLead(
  leadId: string,
  campaignId: string,
  orgId: string,
  options?: {
    aiProvider?: AIProvider;
    enrichmentActors?: string[];
    kpiDefinitions?: KpiDefinition[];
  }
): Promise<void> {
  const supabase = createAdminClient();

  // Load lead
  const { data: leadRows } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .limit(1);
  const lead = leadRows?.[0] ?? null;

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const typedLead = lead as unknown as LFLead;

  // Mark as enriching
  await supabase
    .from("lf_leads")
    .update({ status: "enriching" })
    .eq("id", leadId)
    .eq("organization_id", orgId);

  leadEmitter.emit("lead:status-changed", {
    leadId,
    campaignId,
    oldStatus: typedLead.status,
    newStatus: "enriching",
  });

  try {
    const enrichmentActors = options?.enrichmentActors ?? [];
    const aiProvider = options?.aiProvider ?? "anthropic";
    const kpiDefinitions = options?.kpiDefinitions ?? [];

    // Collect enrichment data from all configured actors
    const rawEnrichmentData: Record<string, unknown> = {};
    const usedActors: string[] = [];

    for (const actorId of enrichmentActors) {
      const actorDef = await getActorById(actorId, orgId);
      if (!actorDef) continue;

      // Build input from lead data
      const actorInput = buildEnrichmentInput(typedLead, actorDef.id);
      if (!actorInput) continue;

      const coerced = coerceActorInput(actorInput, actorDef);

      try {
        const { items, costUsd } = await runActorAndCollect(
          actorId,
          coerced,
          orgId,
          campaignId
        );

        rawEnrichmentData[actorId] = items;
        usedActors.push(actorId);

        // Accumulate apify costs
        if (costUsd) {
          await supabase
            .from("lf_leads")
            .update({
              apify_cost_usd: (typedLead.apify_cost_usd || 0) + costUsd,
            })
            .eq("id", leadId)
            .eq("organization_id", orgId);
        }
      } catch {
        // Actor failure is non-fatal for enrichment
        rawEnrichmentData[actorId] = { error: "Actor run failed" };
      }
    }

    // Run AI analysis on collected data
    const aiResult = await analyzeEnrichmentData(
      typedLead,
      rawEnrichmentData,
      kpiDefinitions,
      aiProvider,
      orgId,
      campaignId
    );

    // Upsert personalization record
    const personalizationData = {
        lead_id: leadId,
        website_tech_stack: aiResult.techStack,
        website_quality_score: aiResult.websiteQualityScore,
        has_chatbot: aiResult.hasChatbot,
        has_booking_system: aiResult.hasBookingSystem,
        has_automation: aiResult.hasAutomation,
        recent_news: aiResult.recentNews,
        company_description: aiResult.companyDescription,
        key_products: aiResult.keyProducts,
        founders_info: aiResult.foundersInfo,
        last_blog_post: aiResult.lastBlogPost,
        social_media_presence: aiResult.socialMediaPresence,
        pain_points: aiResult.painPoints,
        personalization_summary: aiResult.personalizationSummary,
        enrichment_actors: usedActors,
        raw_enrichment_data: rawEnrichmentData,
        campaign_kpis: aiResult.kpis,
      };
    await supabase.from("lf_lead_personalization").upsert(
      personalizationData as never,
      { onConflict: "lead_id" }
    );

    // Update lead score and status
    const leadUpdateData = {
        score: aiResult.score,
        status: "qualified",
        mapped_data: {
          ...(typedLead.mapped_data || {}),
          ...aiResult.extractedFields,
        },
      };
    await supabase
      .from("lf_leads")
      .update(leadUpdateData as never)
      .eq("id", leadId)
      .eq("organization_id", orgId);

    // Emit KPI event
    if (Object.keys(aiResult.kpis).length > 0) {
      leadEmitter.emit("lead:kpi-updated", {
        leadId,
        campaignId,
        kpis: aiResult.kpis,
      });
    }

    // Emit enrichment completion
    leadEmitter.emit("lead:enrichment-completed", {
      leadId,
      campaignId,
      displayName: typedLead.display_name,
      personalizationSummary: aiResult.personalizationSummary,
      score: aiResult.score,
      status: "qualified",
    });
  } catch (err) {
    // Revert to previous status on failure
    await supabase
      .from("lf_leads")
      .update({ status: "new" })
      .eq("id", leadId)
      .eq("organization_id", orgId);

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Batch enrichment for a campaign
// ---------------------------------------------------------------------------

export async function enrichCampaignLeads(
  campaignId: string,
  orgId: string,
  options?: { limit?: number; concurrency?: number }
): Promise<{ enriched: number; failed: number; cancelled: boolean }> {
  const supabase = createAdminClient();
  clearCancellation(campaignId);

  // Load campaign for config
  const { data: campRows } = await supabase
    .from("lf_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .limit(1);
  const campaign = campRows?.[0] ?? null;

  if (!campaign) throw new Error("Campaign not found");

  const typedCampaign = campaign as unknown as LFCampaign;

  // Resolve actor phases and keep only enrichment-phase actors
  const allActorIds = typedCampaign.apify_actors ?? [];
  const enrichmentActors: string[] = [];
  for (const id of allActorIds) {
    const def = await getActorById(id, orgId);
    if (def?.phase === "enrich") enrichmentActors.push(id);
  }

  const concurrency = options?.concurrency ?? typedCampaign.enrichment_concurrency ?? 1;
  const limit = options?.limit ?? typedCampaign.max_leads_per_run ?? 50;

  // Get unenriched leads
  const { data: leads } = await supabase
    .from("lf_leads")
    .select("id, display_name")
    .eq("campaign_id", campaignId)
    .eq("organization_id", orgId)
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!leads || leads.length === 0) {
    return { enriched: 0, failed: 0, cancelled: false };
  }

  let enriched = 0;
  let failed = 0;

  // Process in batches of `concurrency`
  for (let i = 0; i < leads.length; i += concurrency) {
    if (isCancelled(campaignId)) {
      clearCancellation(campaignId);
      return { enriched, failed, cancelled: true };
    }

    const batch = leads.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((lead) =>
        enrichSingleLead(lead.id, campaignId, orgId, {
          aiProvider: typedCampaign.ai_provider,
          enrichmentActors,
          kpiDefinitions: typedCampaign.kpi_definitions,
        })
      )
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") enriched++;
      else failed++;
    }

    // Emit progress
    leadEmitter.emit("campaign:enrichment-progress", {
      campaignId,
      completed: enriched + failed,
      total: leads.length,
      currentLeadId: batch[batch.length - 1]?.id ?? null,
      currentLeadName: batch[batch.length - 1]?.display_name ?? null,
    });
  }

  clearCancellation(campaignId);
  return { enriched, failed, cancelled: false };
}

// =============================================================================
// Internal helpers
// =============================================================================

function buildEnrichmentInput(
  lead: LFLead,
  actorId: string
): Record<string, unknown> | null {
  // Website crawler / contact scraper → need a URL
  if (
    actorId.includes("website") ||
    actorId.includes("contact") ||
    actorId.includes("content")
  ) {
    if (!lead.website) return null;
    return {
      startUrls: [lead.website],
      maxCrawlPages: 10,
      maxDepth: 2,
    };
  }

  // Social media scraper → need social URLs from raw data
  if (actorId.includes("social")) {
    const urls: string[] = [];
    const raw = lead.raw_data || {};
    for (const key of [
      "facebookUrl",
      "instagramUrl",
      "twitterUrl",
      "linkedinUrl",
    ]) {
      if (typeof raw[key] === "string" && raw[key]) {
        urls.push(raw[key] as string);
      }
    }
    if (urls.length === 0) return null;
    return { urls };
  }

  return null;
}

interface EnrichmentAIResult {
  techStack: string[];
  websiteQualityScore: number | null;
  hasChatbot: boolean;
  hasBookingSystem: boolean;
  hasAutomation: boolean;
  recentNews: string | null;
  companyDescription: string | null;
  keyProducts: string | null;
  foundersInfo: string | null;
  lastBlogPost: string | null;
  socialMediaPresence: Record<string, unknown>;
  painPoints: string[];
  personalizationSummary: string | null;
  kpis: Record<string, boolean | string>;
  score: number;
  extractedFields: Record<string, unknown>;
}

async function analyzeEnrichmentData(
  lead: LFLead,
  rawData: Record<string, unknown>,
  kpiDefinitions: KpiDefinition[],
  aiProvider: AIProvider,
  orgId: string,
  campaignId: string
): Promise<EnrichmentAIResult> {
  const kpiInstructions =
    kpiDefinitions.length > 0
      ? `\nEvaluate these KPIs:\n${kpiDefinitions
          .map(
            (k) =>
              `- ${k.id} (${k.type}): ${k.label}${k.description ? ` – ${k.description}` : ""}`
          )
          .join("\n")}`
      : "";

  const prompt = `You are analyzing enrichment data for a business lead. Based on the raw data collected from web scraping, provide a structured analysis.

Lead: ${lead.display_name || "Unknown"}
Website: ${lead.website || "N/A"}
Email: ${lead.email || "N/A"}

Raw enrichment data:
${JSON.stringify(rawData, null, 2).slice(0, 8000)}
${kpiInstructions}

Respond in JSON with this exact structure:
{
  "techStack": ["string array of technologies detected"],
  "websiteQualityScore": 0-100,
  "hasChatbot": false,
  "hasBookingSystem": false,
  "hasAutomation": false,
  "recentNews": "string or null",
  "companyDescription": "brief description",
  "keyProducts": "products/services offered",
  "foundersInfo": "founder names and background or null",
  "lastBlogPost": "title and date of most recent blog post or null",
  "socialMediaPresence": {"platform": "url or follower count"},
  "painPoints": ["potential pain points for sales outreach"],
  "personalizationSummary": "2-3 sentence summary useful for personalized outreach",
  "kpis": {${kpiDefinitions.map((k) => `"${k.id}": ${k.type === "boolean" ? "true/false" : '"text value"'}`).join(", ")}},
  "score": 0-100,
  "extractedFields": {}
}`;

  try {
    const response = await generateCompletion(
      [
        { role: "system", content: "You are a lead enrichment analyst. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      aiProvider,
      orgId,
      { temperature: 0.3, maxTokens: 2048 }
    );

    await logLlmCost(response, "enrichment", orgId, campaignId);

    // Update lead LLM costs
    const supabase = createAdminClient();
    await supabase
      .from("lf_leads")
      .update({
        llm_cost_usd: (lead.llm_cost_usd || 0) + response.costUsd,
        llm_input_tokens:
          (lead.llm_input_tokens || 0) + response.inputTokens,
        llm_output_tokens:
          (lead.llm_output_tokens || 0) + response.outputTokens,
      })
      .eq("id", lead.id)
      .eq("organization_id", orgId);

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultEnrichmentResult();
    }

    const parsed = JSON.parse(jsonMatch[0]) as EnrichmentAIResult;
    return {
      techStack: parsed.techStack ?? [],
      websiteQualityScore: parsed.websiteQualityScore ?? null,
      hasChatbot: parsed.hasChatbot ?? false,
      hasBookingSystem: parsed.hasBookingSystem ?? false,
      hasAutomation: parsed.hasAutomation ?? false,
      recentNews: parsed.recentNews ?? null,
      companyDescription: parsed.companyDescription ?? null,
      keyProducts: parsed.keyProducts ?? null,
      foundersInfo: parsed.foundersInfo ?? null,
      lastBlogPost: parsed.lastBlogPost ?? null,
      socialMediaPresence: parsed.socialMediaPresence ?? {},
      painPoints: parsed.painPoints ?? [],
      personalizationSummary: parsed.personalizationSummary ?? null,
      kpis: parsed.kpis ?? {},
      score: typeof parsed.score === "number" ? parsed.score : 50,
      extractedFields: parsed.extractedFields ?? {},
    };
  } catch {
    return defaultEnrichmentResult();
  }
}

function defaultEnrichmentResult(): EnrichmentAIResult {
  return {
    techStack: [],
    websiteQualityScore: null,
    hasChatbot: false,
    hasBookingSystem: false,
    hasAutomation: false,
    recentNews: null,
    companyDescription: null,
    keyProducts: null,
    foundersInfo: null,
    lastBlogPost: null,
    socialMediaPresence: {},
    painPoints: [],
    personalizationSummary: null,
    kpis: {},
    score: 50,
    extractedFields: {},
  };
}
