import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { planCampaign } from "@/lib/lead-finder/ai/campaign-planner";
import type { AIProvider } from "@/lib/lead-finder/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();
    const body = await req.json();
    const { description, aiProvider } = body as {
      description: string;
      aiProvider?: AIProvider;
    };

    if (!description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
