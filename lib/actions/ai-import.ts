"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, logTokenUsage } from "@/lib/ai/client";
import { getModelForFeature } from "@/lib/ai/models";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { aiScoreLead } from "./ai-scoring";
import { aiQualifyLead } from "./ai-qualification";
import { aiMatchLead } from "./ai-icp";

// ── Parse AI JSON response ──────────────────────────────────────────────────

function parseAIJson<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ── Valid lead field descriptions for AI mapping ────────────────────────────

const LEAD_FIELD_DESCRIPTIONS: Record<string, string> = {
  name: "Full name of the lead/contact",
  email: "Email address",
  company: "Company or organization name",
  phone: "Phone number",
  status: "Lead status (cold, warm, hot, qualified, unqualified, lost, converted)",
  source: "Lead source (website, referral, linkedin, cold-outreach, etc.)",
  industry: "Company industry/vertical",
  employees: "Number of employees (numeric)",
  website: "Company website URL",
  estimated_value: "Estimated deal value in dollars (numeric)",
  location: "City, state, or country",
  linkedin: "LinkedIn profile URL",
  twitter: "Twitter/X handle or URL",
  facebook: "Facebook profile URL",
  instagram: "Instagram handle or URL",
  title: "Job title or role",
  pain_points: "Known pain points or challenges",
  trigger_event: "Trigger event that prompted outreach",
  timezone: "Timezone (e.g., America/New_York, EST)",
  preferred_language: "Preferred language for communication",
  tags: "Comma-separated tags/labels",
  revenue_range: "Company revenue range (e.g., $1M-$10M)",
  tech_stack: "Technologies or tools they use",
  funding_stage: "Funding stage (seed, series-a, series-b, etc.)",
  decision_role: "Role in buying decision (decision-maker, influencer, champion, etc.)",
  current_solution: "Current solution/competitor they use",
  referred_by: "Who referred this lead",
  personal_note: "Personal notes about the lead",
  birthday: "Birthday (YYYY-MM-DD)",
  content_interests: "Comma-separated content interests",
  meeting_preference: "Meeting preference (video, phone, in-person)",
  assistant_name: "Executive assistant name",
  assistant_email: "Executive assistant email",
};

// ── AI Field Mapping ────────────────────────────────────────────────────────

export async function aiMapCSVFields(
  headers: string[],
  sampleRows: string[][]
): Promise<{ mapping: Record<string, string> } | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();

    const model = getModelForFeature("import_enrichment", undefined, settings.ai_provider);

    const fieldList = Object.entries(LEAD_FIELD_DESCRIPTIONS)
      .map(([key, desc]) => `- "${key}": ${desc}`)
      .join("\n");

    const sampleData = sampleRows
      .slice(0, 3)
      .map((row, i) => `Row ${i + 1}: ${row.join(" | ")}`)
      .join("\n");

    const prompt = `You are a CSV field mapping expert. Match each CSV column header to the best matching CRM lead field.

CSV Headers: ${JSON.stringify(headers)}

Sample data:
${sampleData}

Available CRM fields:
${fieldList}

For each CSV header, return the best matching CRM field name, or "__skip__" if no good match exists.

Return ONLY a JSON object like: { "CSV Header 1": "crm_field", "CSV Header 2": "__skip__", ... }
Include every CSV header in the result.`;

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const mapping = parseAIJson<Record<string, string>>(text);

    await logTokenUsage({
      orgId,
      userId,
      feature: "import_enrichment",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs: Date.now() - startTime,
      success: true,
      metadata: { action: "field_mapping", headerCount: headers.length },
    });

    return { mapping };
  } catch (error) {
    return { error: `AI field mapping failed: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// ── AI Lead Enrichment ──────────────────────────────────────────────────────

export async function aiEnrichLead(
  leadId: string
): Promise<{ enriched: boolean } | { error: string }> {
  const startTime = Date.now();

  try {
    const { client, settings, orgId, userId } = await getAIClient();
    const supabase = await createClient();

    const model = getModelForFeature("import_enrichment", undefined, settings.ai_provider);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message}` };
    }

    // Build context of what we know and what's missing
    const knownFields: Record<string, unknown> = {};
    const missingFields: string[] = [];

    for (const [field, desc] of Object.entries(LEAD_FIELD_DESCRIPTIONS)) {
      const dbField = field as keyof typeof lead;
      const val = lead[dbField];
      if (val !== null && val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)) {
        knownFields[field] = val;
      } else {
        missingFields.push(`${field}: ${desc}`);
      }
    }

    // If most fields are filled, skip enrichment
    if (missingFields.length < 5) {
      return { enriched: false };
    }

    const prompt = `You are a B2B lead data enrichment expert. Based on the known data about this lead, infer reasonable values for the missing fields.

Known data:
${JSON.stringify(knownFields, null, 2)}

Missing fields to fill (only fill if you can make a reasonable inference):
${missingFields.join("\n")}

Rules:
- Only fill fields where you have reasonable confidence based on the known data
- For "industry": infer from company name if recognizable
- For "revenue_range": estimate from company size/industry if possible
- For "decision_role": infer from job title
- For "employees": estimate from company if recognizable
- For "timezone": infer from location if available
- Do NOT make up email addresses, phone numbers, social media handles, or personal details like birthday
- Do NOT fill fields you cannot reasonably infer

Return ONLY a JSON object with the fields you can fill and their values. Empty object {} if nothing can be inferred.`;

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const enrichedData = parseAIJson<Record<string, unknown>>(text);

    await logTokenUsage({
      orgId,
      userId,
      feature: "import_enrichment",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs: Date.now() - startTime,
      success: true,
      metadata: { action: "enrichment", leadId, fieldsEnriched: Object.keys(enrichedData).length },
    });

    // Update lead with enriched data (only valid fields)
    const validUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(enrichedData)) {
      if (key in LEAD_FIELD_DESCRIPTIONS && value !== null && value !== undefined && value !== "") {
        // Handle array fields
        if ((key === "tags" || key === "content_interests") && typeof value === "string") {
          validUpdates[key] = value.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else if (key === "estimated_value" || key === "employees") {
          const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
          if (!isNaN(num)) validUpdates[key] = num;
        } else {
          validUpdates[key] = value;
        }
      }
    }

    if (Object.keys(validUpdates).length > 0) {
      await supabase
        .from("leads")
        .update(validUpdates)
        .eq("id", leadId);
    }

    return { enriched: Object.keys(validUpdates).length > 0 };
  } catch (error) {
    return { error: `Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// ── Batch Enrich Leads ──────────────────────────────────────────────────────

export async function aiEnrichLeadsBatch(
  leadIds: string[]
): Promise<{ enriched: number; errors: string[] }> {
  let enriched = 0;
  const errors: string[] = [];

  for (const leadId of leadIds) {
    try {
      const result = await aiEnrichLead(leadId);
      if ("enriched" in result && result.enriched) {
        enriched++;
      } else if ("error" in result) {
        errors.push(result.error);
      }
    } catch (error) {
      errors.push(`Lead ${leadId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { enriched, errors };
}

// ── Process Imported Leads (Orchestrator) ───────────────────────────────────

export interface ImportProcessingResult {
  enriched: number;
  scored: number;
  qualified: number;
  matched: number;
  errors: string[];
}

export async function processImportedLeads(
  leadIds: string[],
  onProgress?: (step: string, current: number, total: number) => void
): Promise<ImportProcessingResult> {
  const result: ImportProcessingResult = {
    enriched: 0,
    scored: 0,
    qualified: 0,
    matched: 0,
    errors: [],
  };

  const total = leadIds.length;

  // Step 1: Enrich
  for (let i = 0; i < leadIds.length; i++) {
    try {
      const enrichResult = await aiEnrichLead(leadIds[i]);
      if ("enriched" in enrichResult && enrichResult.enriched) result.enriched++;
    } catch (e) {
      result.errors.push(`Enrich ${leadIds[i]}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // Step 2: Score
  for (let i = 0; i < leadIds.length; i++) {
    try {
      const scoreResult = await aiScoreLead(leadIds[i]);
      if (!("error" in scoreResult)) result.scored++;
    } catch (e) {
      result.errors.push(`Score ${leadIds[i]}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // Step 3: Qualify (BANT + MEDDIC)
  for (let i = 0; i < leadIds.length; i++) {
    try {
      const qualResult = await aiQualifyLead(leadIds[i]);
      if (!("error" in qualResult)) result.qualified++;
    } catch (e) {
      result.errors.push(`Qualify ${leadIds[i]}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // Step 4: ICP Match (only if org has ICP profiles)
  try {
    const supabase = await createClient();
    const { data: profiles } = await supabase
      .from("icp_profiles")
      .select("id")
      .limit(1);

    if (profiles && profiles.length > 0) {
      for (let i = 0; i < leadIds.length; i++) {
        try {
          const matchResult = await aiMatchLead(leadIds[i]);
          if (!("error" in matchResult)) result.matched++;
        } catch (e) {
          result.errors.push(`Match ${leadIds[i]}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
    }
  } catch {
    // ICP matching is optional, skip on error
  }

  return result;
}

// ── Process Imported Leads Step-by-Step (for UI progress) ───────────────────

export async function processImportedLeadsStep(
  leadIds: string[],
  step: "enrich" | "score" | "qualify" | "match"
): Promise<{ processed: number; errors: string[] }> {
  let processed = 0;
  const errors: string[] = [];

  for (const leadId of leadIds) {
    try {
      if (step === "enrich") {
        const r = await aiEnrichLead(leadId);
        if ("enriched" in r && r.enriched) processed++;
        else if ("error" in r) errors.push(r.error);
        else processed++; // No enrichment needed counts as processed
      } else if (step === "score") {
        const r = await aiScoreLead(leadId);
        if (!("error" in r)) processed++;
        else errors.push(r.error);
      } else if (step === "qualify") {
        const r = await aiQualifyLead(leadId);
        if (!("error" in r)) processed++;
        else errors.push(r.error);
      } else if (step === "match") {
        const r = await aiMatchLead(leadId);
        if (!("error" in r)) processed++;
        else errors.push(r.error);
      }
    } catch (e) {
      errors.push(`${step} ${leadId}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { processed, errors };
}
