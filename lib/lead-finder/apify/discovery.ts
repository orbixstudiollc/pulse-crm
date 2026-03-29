import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { runActorAndCollect } from "./runner";
import { normalizeSingleItem } from "./normalizer";
import { coerceActorInput } from "./coerce-input";
import { getActorById } from "./registry-server";
import { leadEmitter } from "../events/emitter";
import type {
  ActorRunResult,
  DiscoveryResult,
  LFCampaign,
  NewLFLead,
} from "../types";

// =============================================================================
// Discovery – Run actors and ingest leads for a campaign
// =============================================================================

/**
 * Run a single Apify actor with the given input, normalize results, deduplicate,
 * and insert new leads into lf_leads.
 */
export async function runSingleActorDiscovery(
  actorId: string,
  input: Record<string, unknown>,
  campaignId: string,
  orgId: string
): Promise<ActorRunResult> {
  const supabase = createAdminClient();

  try {
    // Resolve actor definition for input coercion
    const actorDef = await getActorById(actorId, orgId);
    const coercedInput = coerceActorInput(input, actorDef);

    // Run actor and collect results
    const { items, runId, dbId, costUsd } = await runActorAndCollect(
      actorId,
      coercedInput,
      orgId,
      campaignId
    );

    if (items.length === 0) {
      return {
        actorId,
        status: "succeeded",
        runId,
        totalResults: 0,
        inserted: 0,
        deduplicated: 0,
      };
    }

    // Normalize all items
    const normalizedLeads: NewLFLead[] = items.map((item) =>
      normalizeSingleItem(item, actorId, orgId, campaignId, dbId)
    );

    // Deduplicate against existing leads in this org
    const { inserted, deduplicated } = await insertWithDedup(
      normalizedLeads,
      campaignId,
      orgId
    );

    // Update run cost on leads
    if (costUsd && inserted > 0) {
      const costPerLead = costUsd / inserted;
      await supabase
        .from("lf_leads")
        .update({ discovery_apify_cost_usd: costPerLead })
        .eq("campaign_id", campaignId)
        .eq("source_run_id", dbId)
        .eq("organization_id", orgId);
    }

    return {
      actorId,
      status: "succeeded",
      runId,
      totalResults: items.length,
      inserted,
      deduplicated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errorType =
      err && typeof err === "object" && "errorType" in err
        ? String((err as { errorType: string }).errorType)
        : undefined;

    return {
      actorId,
      status: "failed",
      totalResults: 0,
      inserted: 0,
      deduplicated: 0,
      error: message,
      errorType,
    };
  }
}

/**
 * Run the full discovery pipeline for a campaign.
 * Iterates through all configured actors and merges results.
 */
export async function runCampaignDiscovery(
  campaignId: string,
  orgId: string
): Promise<DiscoveryResult> {
  const supabase = createAdminClient();

  // Load campaign
  const { data: campRows } = await supabase
    .from("lf_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .limit(1);
  const campaign = campRows?.[0] ?? null;

  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  const typedCampaign = campaign as unknown as LFCampaign;
  const actorIds = typedCampaign.apify_actors ?? [];
  const actorConfigs = typedCampaign.actor_configs ?? {};

  if (actorIds.length === 0) {
    throw new Error("Campaign has no actors configured");
  }

  // Emit start event
  leadEmitter.emit("campaign:discovery-started", {
    campaignId,
    actorIds,
  });

  // Run each actor sequentially
  const results: ActorRunResult[] = [];
  let totalInserted = 0;
  let totalDeduplicated = 0;

  for (const actorId of actorIds) {
    const input = actorConfigs[actorId] ?? {};

    // Apply page limit from campaign settings
    const actorDef = await getActorById(actorId, orgId);
    if (actorDef?.pageLimitKey && typedCampaign.max_pages_per_search > 0) {
      (input as Record<string, unknown>)[actorDef.pageLimitKey] =
        typedCampaign.max_pages_per_search;
    }

    const result = await runSingleActorDiscovery(
      actorId,
      input as Record<string, unknown>,
      campaignId,
      orgId
    );

    results.push(result);
    totalInserted += result.inserted;
    totalDeduplicated += result.deduplicated;
  }

  // Update campaign timestamps
  await supabase
    .from("lf_campaigns")
    .update({
      last_discovery_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("organization_id", orgId);

  // Emit completion event
  leadEmitter.emit("campaign:discovery-completed", {
    campaignId,
    totalInserted,
    totalDeduplicated,
  });

  return { results, totalInserted, totalDeduplicated };
}

// =============================================================================
// Deduplication & insertion
// =============================================================================

async function insertWithDedup(
  leads: NewLFLead[],
  campaignId: string,
  orgId: string
): Promise<{ inserted: number; deduplicated: number }> {
  const supabase = createAdminClient();

  // Load existing emails + websites + display_names for dedup
  const { data: existingLeads } = await supabase
    .from("lf_leads")
    .select("email, website, display_name")
    .eq("organization_id", orgId);

  const existingEmails = new Set(
    (existingLeads ?? [])
      .map((l) => l.email?.toLowerCase())
      .filter(Boolean)
  );
  const existingWebsites = new Set(
    (existingLeads ?? [])
      .map((l) => normalizeUrl(l.website))
      .filter(Boolean)
  );

  let inserted = 0;
  let deduplicated = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];

    // Check dedup by email
    if (lead.email && existingEmails.has(lead.email.toLowerCase())) {
      deduplicated++;
      continue;
    }

    // Check dedup by website (if no email)
    if (
      !lead.email &&
      lead.website &&
      existingWebsites.has(normalizeUrl(lead.website))
    ) {
      deduplicated++;
      continue;
    }

    // Insert
    const insertPayload = {
        organization_id: orgId,
        campaign_id: campaignId,
        source: lead.source,
        source_run_id: lead.source_run_id ?? null,
        display_name: lead.display_name ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        website: lead.website ?? null,
        status: lead.status ?? "new",
        raw_data: lead.raw_data ?? {},
        mapped_data: lead.mapped_data ?? {},
        score: 0,
        llm_cost_usd: 0,
        llm_input_tokens: 0,
        llm_output_tokens: 0,
        apify_cost_usd: 0,
        discovery_llm_cost_usd: lead.discovery_llm_cost_usd ?? 0,
        discovery_apify_cost_usd: lead.discovery_apify_cost_usd ?? 0,
        imported: false,
      };
    const { data: newLead, error: insertErr } = await supabase
      .from("lf_leads")
      .insert(insertPayload as never)
      .select("id, created_at")
      .single();

    if (insertErr || !newLead) {
      continue;
    }

    inserted++;

    // Track in dedup sets
    if (lead.email) existingEmails.add(lead.email.toLowerCase());
    if (lead.website) existingWebsites.add(normalizeUrl(lead.website)!);

    // Emit event
    leadEmitter.emit("lead:discovered", {
      leadId: newLead.id,
      campaignId,
      displayName: lead.display_name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      website: lead.website ?? null,
      status: lead.status ?? "new",
      rawData: lead.raw_data ?? null,
      mappedData: lead.mapped_data ?? null,
      createdAt: newLead.created_at,
      source: lead.source,
      index: i,
      totalItems: leads.length,
    });
  }

  return { inserted, deduplicated };
}

// ---------------------------------------------------------------------------
// URL normalization for dedup
// ---------------------------------------------------------------------------

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(
      url.startsWith("http") ? url : `https://${url}`
    );
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "");
  }
}
