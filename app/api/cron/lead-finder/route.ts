import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runCampaignDiscovery } from "@/lib/lead-finder/apify/discovery";
import { enrichCampaignLeads } from "@/lib/lead-finder/enrichment/pipeline";
import type { LFCampaign } from "@/lib/lead-finder/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    // Authenticate via CRON_SECRET header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      enrichment: { enriched: number; failed: number } | null;
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
                enriched: enrichmentResult.enriched,
                failed: enrichmentResult.failed,
              }
            : null,
        });
      } catch (err) {
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          discovery: null,
          enrichment: null,
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} campaigns`,
      processed: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
