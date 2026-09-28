import "server-only";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { runActorAndCollect } from "../apify/runner";
import { getActorById } from "../apify/registry-server";
import { coerceActorInput } from "../apify/coerce-input";
import { generateCompletion, logLlmCost } from "../ai-provider";
import { leadEmitter } from "../events/emitter";
import { enabledEnrichActorsForCampaign } from "./actor-selection";
import type {
  AIProvider,
  LFCampaign,
  LFLead,
  KpiDefinition,
  LeadFieldDefinition,
} from "../types";

// =============================================================================
// Enrichment Pipeline – enriches discovered leads with website/social data + AI
// =============================================================================

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
    leadFieldDefinitions?: LeadFieldDefinition[];
    jobId?: string;
  }
): Promise<{ persisted: boolean }> {
  // Admin client: this runs from the worker (cron / boot) with no user session.
  // Every query below is explicitly scoped by organization_id or an org-checked lead_id.
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
    const leadFieldDefinitions = options?.leadFieldDefinitions ?? [];

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
      leadFieldDefinitions,
      aiProvider,
      orgId,
      campaignId
    );

    // Compare-and-swap the job to done BEFORE persisting. If the job was
    // cancelled (or already finished/failed) while we were running, the CAS
    // matches no row and the result is discarded. `retry` is accepted only
    // because recoverStaleRunning can flip a still-executing job to retry.
    if (options?.jobId) {
      const { data: claimed, error: casError } = await createAdminClient()
        .from("lf_enrichment_jobs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", options.jobId)
        .in("status", ["running", "retry"])
        .select("id");
      if (casError) throw new Error(casError.message);
      if (!claimed || claimed.length === 0) {
        await supabase
          .from("lf_leads")
          .update({ status: typedLead.status })
          .eq("id", leadId)
          .eq("organization_id", orgId)
          .eq("status", "enriching");
        return { persisted: false };
      }
    }

    try {
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
      const { error: upsertErr } = await supabase
        .from("lf_lead_personalization")
        .upsert(personalizationData as never, { onConflict: "lead_id" });
      if (upsertErr) throw new Error(upsertErr.message);

      // Update lead score and status
      const leadUpdateData = {
          score: aiResult.score,
          status: "qualified",
          mapped_data: {
            ...(typedLead.mapped_data || {}),
            ...aiResult.extractedFields,
          },
        };
      const { error: leadUpdErr } = await supabase
        .from("lf_leads")
        .update(leadUpdateData as never)
        .eq("id", leadId)
        .eq("organization_id", orgId);
      if (leadUpdErr) throw new Error(leadUpdErr.message);
    } catch (err) {
      if (options?.jobId) {
        await createAdminClient()
          .from("lf_enrichment_jobs")
          .update({ status: "running", last_error: String(err).slice(0, 500) })
          .eq("id", options.jobId)
          .eq("status", "done");
      }
      throw err;
    }

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

    return { persisted: true };
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
// Batch enrichment – enqueues all "new" leads in a campaign into the durable
// enrichment queue. Returns immediately; the background worker drains jobs.
// ---------------------------------------------------------------------------

export async function enrichCampaignLeads(
  campaignId: string,
  orgId: string,
  options?: { limit?: number }
): Promise<{
  enqueued: number;
  skipped: number;
  remaining: number;
  batchId?: string;
}> {
  const admin = createAdminClient();

  // Reset any stale "enriching" leads (from previous crashed runs) to "new"
  await admin
    .from("lf_leads")
    .update({ status: "new" })
    .eq("campaign_id", campaignId)
    .eq("organization_id", orgId)
    .eq("status", "enriching");

  const { data: campaign } = await admin
    .from("lf_campaigns")
    .select("id, name, apify_actors, max_leads_per_run")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found");

  const typedCampaign = campaign as unknown as Pick<
    LFCampaign,
    "id" | "name" | "apify_actors" | "max_leads_per_run"
  >;
  const actorIds = await enabledEnrichActorsForCampaign(
    typedCampaign,
    orgId
  );

  const limit =
    options?.limit ?? typedCampaign.max_leads_per_run ?? 9999;

  const { data: candidateLeads } = await admin
    .from("lf_leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("organization_id", orgId)
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);

  const candidates = (candidateLeads ?? []).map((l) => l.id);
  if (candidates.length === 0) {
    return { enqueued: 0, skipped: 0, remaining: 0 };
  }

  // Skip leads that already have active/queued enrichment jobs
  const { data: activeRows } = await admin
    .from("lf_enrichment_jobs")
    .select("lead_id")
    .in("lead_id", candidates)
    .in("status", ["queued", "retry", "running"]);
  const active = new Set((activeRows ?? []).map((r) => r.lead_id));
  const toEnqueue = candidates.filter((id) => !active.has(id));

  if (toEnqueue.length === 0) {
    return {
      enqueued: 0,
      skipped: candidates.length,
      remaining: 0,
    };
  }

  const label = typedCampaign.name
    ? `${typedCampaign.name} — campaign enrich`
    : `Campaign ${campaignId} enrich`;

  const { data: batchRow, error: batchErr } = await admin
    .from("lf_enrichment_batches")
    .insert({
      organization_id: orgId,
      campaign_id: campaignId,
      label,
      total: toEnqueue.length,
      status: "queued",
    } as never)
    .select("id")
    .single();
  if (batchErr || !batchRow) {
    throw new Error(
      `Failed to create enrichment batch: ${batchErr?.message}`
    );
  }
  const batchId = batchRow.id as string;

  // Insert jobs in chunks to stay within payload limits
  const CHUNK = 500;
  for (let i = 0; i < toEnqueue.length; i += CHUNK) {
    const chunk = toEnqueue.slice(i, i + CHUNK);
    const rows = chunk.map((leadId) => ({
      organization_id: orgId,
      batch_id: batchId,
      lead_id: leadId,
      actor_ids: actorIds,
      status: "queued" as const,
    }));
    const { error: jobsErr } = await admin
      .from("lf_enrichment_jobs")
      .insert(rows as never);
    if (jobsErr) {
      throw new Error(
        `Failed to enqueue enrichment jobs: ${jobsErr.message}`
      );
    }
  }

  // Kick the worker
  try {
    const { workerPump } = await import("./worker");
    workerPump();
  } catch (err) {
    console.error(
      "[lead-finder] Failed to start enrichment worker:",
      err
    );
  }

  leadEmitter.emit("campaign:enrichment-progress", {
    campaignId,
    completed: 0,
    total: toEnqueue.length,
    currentLeadId: null,
    currentLeadName: null,
    batchId,
  });

  return {
    enqueued: toEnqueue.length,
    skipped: candidates.length - toEnqueue.length,
    remaining: toEnqueue.length,
    batchId,
  };
}

// ---------------------------------------------------------------------------
// Explicit lead-level enqueue (used by bulk-enrich and per-lead triggers)
// ---------------------------------------------------------------------------

export async function enqueueLeadsEnrichment(
  leadIds: string[],
  orgId: string,
  options?: { label?: string; campaignId?: string | null; actorIds?: string[] }
): Promise<{ batchId: string; enqueued: number; skipped: number }> {
  if (leadIds.length === 0) {
    throw new Error("No lead IDs provided");
  }
  const admin = createAdminClient();

  // Validate every lead is in this org (defense in depth against IDOR)
  const { data: ownedLeadsData } = await admin
    .from("lf_leads")
    .select("id, campaign_id")
    .in("id", leadIds)
    .eq("organization_id", orgId);
  const ownedLeads = ownedLeadsData ?? [];
  const ownedIds = new Set(ownedLeads.map((r) => r.id));
  const candidates = leadIds.filter((id) => ownedIds.has(id));
  if (candidates.length === 0) {
    throw new Error("No leads matched the caller's organization");
  }

  const { data: activeRows } = await admin
    .from("lf_enrichment_jobs")
    .select("lead_id")
    .in("lead_id", candidates)
    .in("status", ["queued", "retry", "running"]);
  const active = new Set((activeRows ?? []).map((r) => r.lead_id));
  const toEnqueue = candidates.filter((id) => !active.has(id));

  // Derive a campaignId & actor set: if all leads share a campaign, use it.
  let campaignId: string | null =
    options?.campaignId ?? ownedLeads[0]?.campaign_id ?? null;
  if (
    !options?.campaignId &&
    campaignId &&
    !ownedLeads.every((r) => r.campaign_id === campaignId)
  ) {
    campaignId = null;
  }

  let actorIds = options?.actorIds ?? [];
  if (actorIds.length === 0 && campaignId) {
    const { data: campaign } = await admin
      .from("lf_campaigns")
      .select("apify_actors")
      .eq("id", campaignId)
      .eq("organization_id", orgId)
      .maybeSingle();
    actorIds = await enabledEnrichActorsForCampaign(
      (campaign as Pick<LFCampaign, "apify_actors"> | null) ?? null,
      orgId
    );
  }
  if (actorIds.length === 0) {
    actorIds = ["vdrmota/contact-info-scraper"];
  }

  const { data: batchRow, error: batchErr } = await admin
    .from("lf_enrichment_batches")
    .insert({
      organization_id: orgId,
      campaign_id: campaignId,
      label: options?.label ?? `Bulk enrich (${toEnqueue.length} leads)`,
      total: toEnqueue.length,
      status: toEnqueue.length === 0 ? "done" : "queued",
      finished_at: toEnqueue.length === 0 ? new Date().toISOString() : null,
    } as never)
    .select("id")
    .single();
  if (batchErr || !batchRow) {
    throw new Error(
      `Failed to create enrichment batch: ${batchErr?.message}`
    );
  }
  const batchId = batchRow.id as string;

  if (toEnqueue.length === 0) {
    return {
      batchId,
      enqueued: 0,
      skipped: candidates.length - toEnqueue.length,
    };
  }

  const CHUNK = 500;
  for (let i = 0; i < toEnqueue.length; i += CHUNK) {
    const chunk = toEnqueue.slice(i, i + CHUNK);
    const rows = chunk.map((leadId) => ({
      organization_id: orgId,
      batch_id: batchId,
      lead_id: leadId,
      actor_ids: actorIds,
      status: "queued" as const,
    }));
    const { error: jobsErr } = await admin
      .from("lf_enrichment_jobs")
      .insert(rows as never);
    if (jobsErr) {
      throw new Error(
        `Failed to enqueue enrichment jobs: ${jobsErr.message}`
      );
    }
  }

  try {
    const { workerPump } = await import("./worker");
    workerPump();
  } catch (err) {
    console.error(
      "[lead-finder] Failed to start enrichment worker:",
      err
    );
  }

  return {
    batchId,
    enqueued: toEnqueue.length,
    skipped: candidates.length - toEnqueue.length,
  };
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
  leadFieldDefinitions: LeadFieldDefinition[],
  aiProvider: AIProvider,
  orgId: string,
  campaignId: string
): Promise<EnrichmentAIResult> {
  // Normalize definitions: old campaigns store `key`, new ones store `id`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kpis = kpiDefinitions.map((k) => ({ ...k, id: k.id ?? (k as any).key }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = leadFieldDefinitions.map((f) => ({ ...f, id: f.id ?? (f as any).key }));

  const kpiInstructions =
    kpis.length > 0
      ? `\nEvaluate these KPIs:\n${kpis
          .map(
            (k) =>
              `- ${k.id} (${k.type}): ${k.label}${k.description ? ` – ${k.description}` : ""}`
          )
          .join("\n")}`
      : "";

  const fieldInstructions =
    fields.length > 0
      ? `\nExtract these custom fields into "extractedFields":\n${fields
          .map(
            (f) =>
              `- ${f.id} (${f.type}): ${f.label}${f.description ? ` – ${f.description}` : ""}`
          )
          .join("\n")}`
      : "";

  const extractedFieldsShape =
    fields.length > 0
      ? `{${fields.map((f) => `"${f.id}": ${f.type === "boolean" ? "true/false/null" : '"extracted value or null"'}`).join(", ")}}`
      : "{}";

  // Combine discovery raw_data with any enrichment actor data
  const combinedData = {
    discoveryData: lead.raw_data ?? {},
    ...(Object.keys(rawData).length > 0 ? { enrichmentData: rawData } : {}),
  };

  const prompt = `You are analyzing data for a business lead. Extract structured information from the available data.

Lead: ${lead.display_name || "Unknown"}
Website: ${lead.website || "N/A"}
Email: ${lead.email || "N/A"}
Phone: ${lead.phone || "N/A"}

Available data:
${JSON.stringify(combinedData, null, 2).slice(0, 8000)}
${kpiInstructions}${fieldInstructions}

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
  "kpis": {${kpis.map((k) => `"${k.id}": ${k.type === "boolean" ? "true/false" : '"text value"'}`).join(", ")}},
  "score": 0-100,
  "extractedFields": ${extractedFieldsShape}
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
    const supabase = await createClient();
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
