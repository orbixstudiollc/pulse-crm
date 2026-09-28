import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";
import {
  enrichCampaignLeads,
  cancelEnrichment,
} from "@/lib/lead-finder/enrichment/pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
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
    console.error("[lead-finder/campaigns/:id/enrich] POST error", err);
    return NextResponse.json(
      { error: "Failed to start enrichment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId();

    // SECURITY (IDOR): verify the campaign belongs to this org BEFORE calling
    // cancelEnrichment. Otherwise a malicious tenant could flip the in-memory
    // cancellation flag for another org's campaign (DoS against their run).
    const { data: campRows } = await supabase
      .from("lf_campaigns")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .limit(1);
    if (!campRows || campRows.length === 0) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    cancelEnrichment(id, orgId);

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
    console.error("[lead-finder/campaigns/:id/enrich] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to cancel enrichment" },
      { status: 500 }
    );
  }
}
