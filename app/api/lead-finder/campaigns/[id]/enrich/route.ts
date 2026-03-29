import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import {
  enrichCampaignLeads,
  cancelEnrichment,
} from "@/lib/lead-finder/enrichment/pipeline";

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

    // Verify campaign exists and belongs to org
    const { data: campRows } = await supabase
      .from("lf_campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("organization_id", orgId)
      .limit(1);
    const campaign = campRows?.[0] ?? null;

    if (!campaign)
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );

    const result = await enrichCampaignLeads(id, orgId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
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

    // Cancel the enrichment pipeline
    cancelEnrichment(id);

    // Reset any leads stuck in "enriching" status back to "new"
    const { count } = await supabase
      .from("lf_leads")
      .update({ status: "new" })
      .eq("campaign_id", id)
      .eq("organization_id", orgId)
      .eq("status", "enriching");

    return NextResponse.json({
      success: true,
      message: "Enrichment cancelled",
      resetCount: count ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
