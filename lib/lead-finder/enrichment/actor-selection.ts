import "server-only";

import { getActorById } from "@/lib/lead-finder/apify/registry-server";
import type { LFCampaign } from "@/lib/lead-finder/types";

/**
 * Derive the ordered list of enabled "enrich" phase Apify actors for a campaign.
 *
 * Respects the campaign's explicit `apify_actors` order and filters out any
 * listed under `actor_configs._disabledEnrichActors` or any that aren't
 * registered as enrich-phase actors. If the resulting list is empty, the
 * default contact-info scraper is included so leads can still be enriched
 * on campaigns that were configured with only discovery actors.
 *
 * Tenant-scoped: `orgId` is used to resolve custom/global actor registrations.
 */
export async function enabledEnrichActorsForCampaign(
  campaign:
    | (Pick<LFCampaign, "apify_actors"> & {
        actor_configs?: Record<string, unknown> | null;
      })
    | null
    | undefined,
  orgId: string
): Promise<string[]> {
  if (!campaign) return [];

  const ordered = Array.isArray(campaign.apify_actors)
    ? (campaign.apify_actors as string[])
    : [];

  const actorConfigs = (campaign.actor_configs ?? {}) as Record<
    string,
    unknown
  >;
  const disabled = new Set<string>(
    Array.isArray(
      (actorConfigs as { _disabledEnrichActors?: unknown })
        ._disabledEnrichActors
    )
      ? ((actorConfigs as { _disabledEnrichActors: unknown[] })
          ._disabledEnrichActors as string[])
      : []
  );

  const enrichIds: string[] = [];
  for (const actorId of ordered) {
    if (disabled.has(actorId)) continue;
    const def = await getActorById(actorId, orgId);
    if (def?.phase === "enrich") enrichIds.push(actorId);
  }

  if (enrichIds.length === 0) {
    enrichIds.push("vdrmota/contact-info-scraper");
  }

  return enrichIds;
}
