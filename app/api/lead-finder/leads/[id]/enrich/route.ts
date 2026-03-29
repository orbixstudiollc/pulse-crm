import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { enrichSingleLead } from "@/lib/lead-finder/enrichment/pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    // Verify lead exists and get campaign info
    const { data: lead } = await supabase
      .from("lf_leads")
      .select("id, campaign_id, status")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    if (lead.status === "enriching") {
      return NextResponse.json(
        { error: "Lead is already being enriched" },
        { status: 400 }
      );
    }

    // Load campaign config for enrichment actors + KPI definitions
    let enrichmentActors: string[] = [];
    let kpiDefinitions: { id: string; label: string; type: "boolean" | "text"; description?: string }[] = [];
    let aiProvider: "openai" | "anthropic" = "anthropic";

    if (lead.campaign_id) {
      const { data: campaign } = await supabase
        .from("lf_campaigns")
        .select("apify_actors, kpi_definitions, ai_provider")
        .eq("id", lead.campaign_id)
        .eq("organization_id", orgId)
        .single();

      if (campaign) {
        enrichmentActors = (campaign.apify_actors as string[]) ?? [];
        kpiDefinitions = (campaign.kpi_definitions as typeof kpiDefinitions) ?? [];
        aiProvider = (campaign.ai_provider as typeof aiProvider) ?? "anthropic";
      }
    }

    await enrichSingleLead(id, lead.campaign_id ?? "", orgId, {
      aiProvider,
      enrichmentActors,
      kpiDefinitions,
    });

    return NextResponse.json({ success: true, leadId: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
