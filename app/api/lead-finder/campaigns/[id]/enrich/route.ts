import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";
import { enrichCampaignLeads } from "@/lib/lead-finder/enrichment/pipeline";

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

    // SECURITY (IDOR): verify the campaign belongs to this org BEFORE
    // cancelling. Otherwise a malicious tenant could cancel another org's
    // enrichment run (DoS against their run).
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

    const { data: batches, error: batchesErr } = await supabase
      .from("lf_enrichment_batches")
      .select("id")
      .eq("campaign_id", id)
      .eq("organization_id", orgId)
      .in("status", ["queued", "running", "paused"]);
    if (batchesErr) throw batchesErr;
    const batchIds = (batches ?? []).map((b) => b.id as string);

    let cancelledJobs = 0;
    if (batchIds.length > 0) {
      const nowIso = new Date().toISOString();
      // Jobs before batches: a crash between the two never leaves a
      // claimable job under an open batch.
      const { count: jobCount, error: jobsErr } = await supabase
        .from("lf_enrichment_jobs")
        .update(
          { status: "cancelled", finished_at: nowIso },
          { count: "exact" }
        )
        .eq("organization_id", orgId)
        .in("batch_id", batchIds)
        .in("status", ["queued", "retry", "running"]);
      if (jobsErr) throw jobsErr;
      cancelledJobs = jobCount ?? 0;

      const { error: batchUpdErr } = await supabase
        .from("lf_enrichment_batches")
        .update({ status: "cancelled", finished_at: nowIso })
        .eq("organization_id", orgId)
        .in("id", batchIds)
        .in("status", ["queued", "running", "paused"]);
      if (batchUpdErr) throw batchUpdErr;
    }

    const { count, error: leadsErr } = await supabase
      .from("lf_leads")
      .update({ status: "new" })
      .eq("campaign_id", id)
      .eq("organization_id", orgId)
      .eq("status", "enriching");
    if (leadsErr) throw leadsErr;

    return NextResponse.json({
      success: true,
      message: "Enrichment cancelled",
      resetCount: count ?? 0,
      cancelledJobs,
    });
  } catch (err) {
    console.error("[lead-finder/campaigns/:id/enrich] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to cancel enrichment" },
      { status: 500 }
    );
  }
}
