import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { runCampaignDiscovery, runSingleActorDiscovery } from "@/lib/lead-finder/apify/discovery";

export async function POST(
  req: NextRequest,
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

    const { data: campRows } = await supabase
      .from("lf_campaigns")
      .select("status, apify_actors, actor_configs")
      .eq("id", id)
      .eq("organization_id", orgId)
      .limit(1);
    const campaign = campRows?.[0] ?? null;

    if (!campaign)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status !== "active")
      return NextResponse.json({ error: "Campaign must be active" }, { status: 400 });

    const actors = (campaign.apify_actors as string[]) || [];
    if (actors.length === 0)
      return NextResponse.json({ error: "No actors configured" }, { status: 400 });

    // Parse optional body — if actorId provided, run only that actor
    let actorId: string | undefined;
    try {
      const body = await req.json();
      actorId = body?.actorId;
    } catch {
      // No body — run all actors
    }

    if (actorId) {
      // Per-actor discovery
      if (!actors.includes(actorId)) {
        return NextResponse.json({ error: "Actor not in campaign" }, { status: 400 });
      }
      const actorConfigs = (campaign.actor_configs as Record<string, Record<string, unknown>>) || {};
      const input = actorConfigs[actorId] ?? {};
      const result = await runSingleActorDiscovery(actorId, input, id, orgId);
      return NextResponse.json({
        success: true,
        inserted: result.inserted,
        totalResults: result.totalResults,
        deduplicated: result.deduplicated,
      });
    }

    // Full campaign discovery
    const result = await runCampaignDiscovery(id, orgId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
