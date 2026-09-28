import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { generateCompletion } from "@/lib/lead-finder/ai-provider";

const AIProviderEnum = z.enum([
  "openai",
  "anthropic",
  "openrouter",
  "groq",
  "ollama",
  "ollama_cloud",
]);

const BodySchema = z.object({
  query: z.string().trim().min(1, "query is required").max(5_000),
  campaignId: z.string().uuid().optional(),
  aiProvider: AIProviderEnum.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const { query, campaignId, aiProvider } = parsed.data;

    // Load campaign field definitions for context
    let fieldContext = "";
    if (campaignId) {
      const { data: campaign } = await supabase
        .from("lf_campaigns")
        .select("lead_field_definitions, kpi_definitions, target_niche")
        .eq("id", campaignId)
        .eq("organization_id", orgId)
        .single();

      if (campaign) {
        const fields =
          (campaign.lead_field_definitions as {
            id: string;
            label: string;
          }[]) ?? [];
        const kpis =
          (campaign.kpi_definitions as {
            id: string;
            label: string;
            type: string;
          }[]) ?? [];
        fieldContext = `
Campaign target: ${campaign.target_niche}
Custom fields: ${fields.map((f) => `${f.id} (${f.label})`).join(", ") || "none"}
KPIs: ${kpis.map((k) => `${k.id} (${k.label}, ${k.type})`).join(", ") || "none"}`;
      }
    }

    const prompt = `You are a lead filter assistant. Convert the following natural language query into structured filter criteria for a lead database.

Available standard fields: display_name, email, phone, website, status (new|enriching|qualified|converted|declined|archived), score (0-100), source, created_at
${fieldContext}

User query: "${query}"

Respond in JSON:
{
  "filters": [
    { "field": "field_name", "operator": "eq|neq|gt|gte|lt|lte|like|in|is_null|not_null", "value": "value" }
  ],
  "sortBy": "field_name or null",
  "sortDir": "asc or desc",
  "explanation": "Brief explanation of the filter logic"
}`;

    const response = await generateCompletion(
      [
        {
          role: "system",
          content:
            "You are a CRM filter expert. Respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      aiProvider || "anthropic",
      orgId,
      { temperature: 0.3, maxTokens: 512 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const parsedResp = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: parsedResp });
  } catch (err) {
    console.error("[lead-finder/ai-filter] error", err);
    return NextResponse.json(
      { error: "AI filter generation failed" },
      { status: 500 }
    );
  }
}
