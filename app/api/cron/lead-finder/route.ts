import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runCampaignDiscovery } from "@/lib/lead-finder/apify/discovery";
import { enrichCampaignLeads } from "@/lib/lead-finder/enrichment/pipeline";
import type { LFCampaign } from "@/lib/lead-finder/types";
import { verifyCronRequest } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function GET(req: NextRequest) {
  const authErr = verifyCronRequest(req);
  if (authErr) return authErr;

  try {

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Find active campaigns with scheduled discovery that are due
    const { data: campaigns, error } = await supabase
      .from("lf_campaigns")
      .select("*")
      .eq("status", "active")
      .neq("schedule_frequency", "once")
      .lte("next_discovery_at", now);

    if (error) {
      console.error("[cron/lead-finder] fetch campaigns failed", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        message: "No campaigns due for discovery",
        processed: 0,
      });
    }

    const results: {
      campaignId: string;
      name: string;
      discovery: { totalInserted: number; totalDeduplicated: number } | null;
      enrichment: {
        enqueued: number;
        skipped: number;
        batchId: string | null;
      } | null;
      error?: string;
    }[] = [];

    for (const rawCampaign of campaigns) {
      const campaign = rawCampaign as unknown as LFCampaign;
      const actors = campaign.apify_actors ?? [];

      if (actors.length === 0) continue;

      try {
        // Run discovery
        const discoveryResult = await runCampaignDiscovery(
          campaign.id,
          campaign.organization_id
        );

        let enrichmentResult = null;

        // Auto-enrich if configured
        if (campaign.auto_enrich && discoveryResult.totalInserted > 0) {
          enrichmentResult = await enrichCampaignLeads(
            campaign.id,
            campaign.organization_id
          );
        }

        // Calculate next discovery time
        const nextDiscoveryAt = calculateNextDiscovery(
          campaign.schedule_frequency
        );

        // Update campaign with next run time
        await supabase
          .from("lf_campaigns")
          .update({
            next_discovery_at: nextDiscoveryAt,
            last_discovery_at: now,
            updated_at: now,
          })
          .eq("id", campaign.id);

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          discovery: {
            totalInserted: discoveryResult.totalInserted,
            totalDeduplicated: discoveryResult.totalDeduplicated,
          },
          enrichment: enrichmentResult
            ? {
                enqueued: enrichmentResult.enqueued,
                skipped: enrichmentResult.skipped,
                batchId: enrichmentResult.batchId ?? null,
              }
            : null,
        });
      } catch (err) {
        console.error(
          `[cron/lead-finder] campaign ${campaign.id} failed`,
          err
        );
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          discovery: null,
          enrichment: null,
          error: "Campaign run failed",
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} campaigns`,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("[cron/lead-finder] unexpected error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function calculateNextDiscovery(
  frequency: "once" | "daily" | "weekly"
): string {
  const next = new Date();
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    default:
      // 'once' should not reach here, but set far future
      next.setFullYear(next.getFullYear() + 100);
      break;
  }
  return next.toISOString();
}
