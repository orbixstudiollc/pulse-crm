import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { generateCompletion, logLlmCost } from "../ai-provider";
import type { AIProvider, LFLead, LeadFieldDefinition } from "../types";

// =============================================================================
// Lead Extractor – AI-powered field extraction from raw lead data
// =============================================================================

/**
 * Extract standard fields (name, email, phone, website) from raw data using AI
 * when the normalizer couldn't find them via heuristics.
 */
export async function extractStaticFields(
  leadId: string,
  orgId: string,
  aiProvider: AIProvider = "anthropic",
  campaignId?: string
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .single();

  if (!lead) throw new Error("Lead not found");
  const typedLead = lead as unknown as LFLead;

  // Only extract if we're missing key fields
  const missingFields: string[] = [];
  if (!typedLead.display_name) missingFields.push("display_name");
  if (!typedLead.email) missingFields.push("email");
  if (!typedLead.phone) missingFields.push("phone");
  if (!typedLead.website) missingFields.push("website");

  if (missingFields.length === 0) {
    return typedLead.mapped_data || {};
  }

  const prompt = `Extract contact information from this raw data. Only extract values you're confident about.

Raw data:
${JSON.stringify(typedLead.raw_data, null, 2).slice(0, 4000)}

Missing fields to extract: ${missingFields.join(", ")}

Respond in JSON with only the fields you found:
{
  ${missingFields.map((f) => `"${f}": "value or null"`).join(",\n  ")}
}`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are a data extraction specialist. Extract only verifiable data. Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.1, maxTokens: 512 }
  );

  await logLlmCost(response, "field-extraction", orgId, campaignId);

  // Update LLM costs on lead
  await supabase
    .from("lf_leads")
    .update({
      llm_cost_usd: (typedLead.llm_cost_usd || 0) + response.costUsd,
      llm_input_tokens:
        (typedLead.llm_input_tokens || 0) + response.inputTokens,
      llm_output_tokens:
        (typedLead.llm_output_tokens || 0) + response.outputTokens,
    })
    .eq("id", leadId)
    .eq("organization_id", orgId);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return typedLead.mapped_data || {};

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Update lead with extracted fields
    const updates: Record<string, unknown> = {};
    if (extracted.display_name && !typedLead.display_name) {
      updates.display_name = extracted.display_name;
    }
    if (extracted.email && !typedLead.email) {
      updates.email = extracted.email;
    }
    if (extracted.phone && !typedLead.phone) {
      updates.phone = extracted.phone;
    }
    if (extracted.website && !typedLead.website) {
      updates.website = extracted.website;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("lf_leads")
        .update(updates as never)
        .eq("id", leadId)
        .eq("organization_id", orgId);
    }

    // Merge into mapped_data
    const newMapped = { ...(typedLead.mapped_data || {}), ...extracted };
    await supabase
      .from("lf_leads")
      .update({ mapped_data: newMapped } as never)
      .eq("id", leadId)
      .eq("organization_id", orgId);

    return newMapped;
  } catch {
    return typedLead.mapped_data || {};
  }
}

/**
 * Extract ALL fields defined by the campaign's lead_field_definitions from raw data.
 */
export async function extractAllFields(
  leadId: string,
  orgId: string,
  fieldDefinitions: LeadFieldDefinition[],
  aiProvider: AIProvider = "anthropic",
  campaignId?: string
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("lf_leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .single();

  if (!lead) throw new Error("Lead not found");
  const typedLead = lead as unknown as LFLead;

  if (fieldDefinitions.length === 0) {
    return typedLead.mapped_data || {};
  }

  const fieldDesc = fieldDefinitions
    .map(
      (f) =>
        `- ${f.id} (${f.type}): ${f.label}${f.description ? ` – ${f.description}` : ""}`
    )
    .join("\n");

  const prompt = `Extract the following custom fields from this lead's raw data.

Raw data:
${JSON.stringify(typedLead.raw_data, null, 2).slice(0, 6000)}

Fields to extract:
${fieldDesc}

Respond in JSON with field IDs as keys:
{
  ${fieldDefinitions.map((f) => `"${f.id}": <${f.type} value or null>`).join(",\n  ")}
}`;

  const response = await generateCompletion(
    [
      {
        role: "system",
        content:
          "You are a data extraction specialist. Extract values from raw data. Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    aiProvider,
    orgId,
    { temperature: 0.1, maxTokens: 1024 }
  );

  await logLlmCost(response, "custom-field-extraction", orgId, campaignId);

  // Update LLM costs
  await supabase
    .from("lf_leads")
    .update({
      llm_cost_usd: (typedLead.llm_cost_usd || 0) + response.costUsd,
      llm_input_tokens:
        (typedLead.llm_input_tokens || 0) + response.inputTokens,
      llm_output_tokens:
        (typedLead.llm_output_tokens || 0) + response.outputTokens,
    })
    .eq("id", leadId)
    .eq("organization_id", orgId);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return typedLead.mapped_data || {};

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Merge into mapped_data
    const newMapped = { ...(typedLead.mapped_data || {}), ...extracted };
    await supabase
      .from("lf_leads")
      .update({ mapped_data: newMapped } as never)
      .eq("id", leadId)
      .eq("organization_id", orgId);

    return newMapped;
  } catch {
    return typedLead.mapped_data || {};
  }
}
