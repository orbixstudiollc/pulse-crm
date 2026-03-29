import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { runCampaignDiscovery } from "@/lib/lead-finder/apify/discovery";

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

    const { data: campaign } = await supabase
      .from("lf_campaigns")
      .select("status, apify_actors")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (!campaign)
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    if (campaign.status !== "active")
      return NextResponse.json(
        { error: "Campaign must be active" },
        { status: 400 }
      );

    const actors = (campaign.apify_actors as string[]) || [];
    if (actors.length === 0)
      return NextResponse.json(
        { error: "No actors configured" },
        { status: 400 }
      );

    const result = await runCampaignDiscovery(id, orgId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
