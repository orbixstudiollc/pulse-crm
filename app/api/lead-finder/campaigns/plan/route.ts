import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { planCampaign } from "@/lib/lead-finder/ai/campaign-planner";

const AIProviderEnum = z.enum([
  "openai",
  "anthropic",
  "openrouter",
  "groq",
  "ollama",
  "ollama_cloud",
  "custom",
]);

const BodySchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "description is required")
    .max(20_000),
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
    const { description, aiProvider } = parsed.data;

    const plan = await planCampaign(
      description,
      orgId,
      aiProvider || "anthropic"
    );

    // Transform to snake_case format expected by the UI
    const aiPlan = {
      name: plan.name,
      target_niche: plan.targetNiche,
      suggested_actors: plan.suggestedActors,
      suggested_search_terms: [] as string[],
      schedule_frequency: "once",
      kpi_definitions: plan.kpiDefinitions.map((k) => ({
        id: k.id,
        label: k.label,
        description: k.description ?? "",
        type: k.type,
      })),
      lead_field_definitions: plan.leadFieldDefinitions.map((f) => ({
        id: f.id,
        label: f.label,
        description: f.description ?? "",
        type: f.type,
      })),
    };

    return NextResponse.json({ data: aiPlan });
  } catch (err) {
    console.error("[lead-finder/campaigns/plan] error", err);
    return NextResponse.json(
      { error: "Failed to plan campaign" },
      { status: 500 }
    );
  }
}
