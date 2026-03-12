"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { getAIClient, checkAIAccess, logTokenUsage } from "@/lib/ai/client";
import { revalidatePath } from "next/cache";

// ── Validate Scraped Leads with AI ────────────────────────────────────────────

export async function validateScrapedLeads(leadIds: string[]): Promise<{
  data: { validated: number; enriched: number } | null;
  error?: string;
}> {
  try {
    // Check AI access
    const access = await checkAIAccess("lead_validation");
    if (!access.allowed) return { data: null, error: access.reason };

    const { client, settings, orgId, userId } = await getAIClient();
    const supabase = await createClient();

    // Get leads
    const { data: leads, error: leadsErr } = await supabase
      .from("scraped_leads")
      .select("*")
      .eq("organization_id", orgId)
      .in("id", leadIds);

    if (leadsErr || !leads?.length) return { data: null, error: "No leads found" };

    let totalValidated = 0;
    let totalEnriched = 0;
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Process in batches of 5
    for (let i = 0; i < leads.length; i += 5) {
      const batch = leads.slice(i, i + 5);

      const leadsData = batch.map((l, idx) => ({
        index: idx,
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        title: l.title,
        company: l.company,
        industry: l.industry,
        location: l.location,
        phone: l.phone,
        source: l.source,
      }));

      const model = settings.default_model === "haiku" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";

      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a B2B lead data quality expert. Validate these leads and return a JSON array.

For each lead, assess:
- Name quality (properly formatted, likely real person/business)
- Email validity (proper format, business vs personal domain)
- Business relevance (real business contact vs spam/fake)
- Data completeness (how many useful fields are filled)

Leads:
${JSON.stringify(leadsData, null, 2)}

Return ONLY a valid JSON array with one object per lead:
[{
  "index": number,
  "cleaned_first_name": string or null,
  "cleaned_last_name": string or null,
  "business_relevance": 0-100,
  "data_quality": 0-100,
  "flags": string[]
}]`,
          },
        ],
      });

      totalInputTokens += response.usage?.input_tokens || 0;
      totalOutputTokens += response.usage?.output_tokens || 0;

      // Parse response
      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      let results: Array<{
        index: number;
        cleaned_first_name?: string | null;
        cleaned_last_name?: string | null;
        business_relevance: number;
        data_quality: number;
        flags?: string[];
      }> = [];

      try {
        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) results = JSON.parse(jsonMatch[0]);
      } catch {
        // If parsing fails, continue with next batch
        continue;
      }

      // Update leads with scores
      for (const result of results) {
        const lead = batch[result.index];
        if (!lead) continue;

        const score = Math.round((result.business_relevance + result.data_quality) / 2);
        const updates: Record<string, unknown> = { ai_quality_score: score };

        // Apply cleaned names if provided
        if (result.cleaned_first_name && result.cleaned_first_name !== lead.first_name) {
          updates.first_name = result.cleaned_first_name;
          totalEnriched++;
        }
        if (result.cleaned_last_name && result.cleaned_last_name !== lead.last_name) {
          updates.last_name = result.cleaned_last_name;
        }

        await supabase
          .from("scraped_leads")
          .update(updates)
          .eq("id", lead.id);

        totalValidated++;
      }
    }

    // Log token usage
    await logTokenUsage({
      orgId,
      userId,
      feature: "lead_validation",
      model: settings.default_model === "haiku" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: Date.now() - startTime,
      success: true,
      metadata: { leadsValidated: totalValidated, leadsEnriched: totalEnriched },
    });

    revalidatePath("/dashboard/lead-scraper");
    return { data: { validated: totalValidated, enriched: totalEnriched } };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "AI validation failed" };
  }
}
