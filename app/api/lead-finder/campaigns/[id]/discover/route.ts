import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { isUuid } from "@/lib/security";
import {
  runCampaignDiscovery,
  runSingleActorDiscovery,
} from "@/lib/lead-finder/apify/discovery";
import { writeCampaignObservation } from "@/lib/lead-finder/obsidian/observer";

const BodySchema = z
  .object({
    actorId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._\-/~]+$/, "Invalid actorId")
      .optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
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
      return NextResponse.json(
        { error: "Campaign must be active" },
        { status: 400 }
      );

    const actors = (campaign.apify_actors as string[]) || [];
    if (actors.length === 0)
      return NextResponse.json({ error: "No actors configured" }, { status: 400 });

    // Body is optional — if present, must be a JSON object matching BodySchema.
    let actorId: string | undefined;
    const contentLength = req.headers.get("content-length");
    const hasBody =
      contentLength !== null && contentLength !== "0" &&
      (req.headers.get("content-type") ?? "").includes("application/json");

    if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      // Allow empty object as "no actor id"
      if (rawBody !== null) {
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid request" },
            { status: 400 }
          );
        }
        actorId = parsed.data.actorId;
      }
    }

    if (actorId) {
      // Per-actor discovery
      if (!actors.includes(actorId)) {
        return NextResponse.json(
          { error: "Actor not in campaign" },
          { status: 400 }
        );
      }
      const actorConfigs =
        (campaign.actor_configs as Record<string, Record<string, unknown>>) ||
        {};
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

    // Best-effort Obsidian observation (no-op when the org hasn't enabled it)
    try {
      const { data: campMeta } = await supabase
        .from("lf_campaigns")
        .select("name, obsidian_sync_enabled")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!campMeta || campMeta.obsidian_sync_enabled !== false) {
        const { data: allLeads } = await supabase
          .from("lf_leads")
          .select("display_name, score")
          .eq("campaign_id", id)
          .eq("organization_id", orgId);

        const scoredLeads = (allLeads ?? []).filter(
          (l) => l.score !== null && l.score !== undefined
        );
        const avgScore = scoredLeads.length
          ? Math.round(
              scoredLeads.reduce((sum, l) => sum + (l.score ?? 0), 0) /
                scoredLeads.length
            )
          : null;
        const topLeads = scoredLeads
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 5)
          .map((l) => ({
            name: l.display_name || "Unknown",
            score: (l.score as number) ?? 0,
          }));

        await writeCampaignObservation(orgId, {
          campaignId: id,
          campaignName: campMeta?.name ?? "Campaign",
          totalLeads: (allLeads ?? []).length,
          newLeads: result.totalInserted,
          avgScore,
          topLeads,
        });
      }
    } catch (obsErr) {
      console.error("[campaign-discover] obsidian write failed", obsErr);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[lead-finder/campaigns/:id/discover] error", err);
    return NextResponse.json(
      { error: "Lead discovery failed" },
      { status: 500 }
    );
  }
}
