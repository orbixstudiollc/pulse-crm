import { getScraperStats, getSavedSearches, searchScrapedLeads } from "@/lib/actions/lead-scraper";
import { getActiveApifyRuns } from "@/lib/actions/apify";
import { LeadScraperPageClient } from "./client";

export default async function LeadScraperPage() {
  const [
    { data: stats },
    { data: savedSearches },
    { data: leads, count },
    { data: activeRuns },
  ] = await Promise.all([
    getScraperStats(),
    getSavedSearches(),
    searchScrapedLeads(undefined, { limit: 25 }),
    getActiveApifyRuns(),
  ]);

  return (
    <LeadScraperPageClient
      initialStats={stats}
      initialSearches={savedSearches}
      initialLeads={leads}
      initialCount={count}
      initialActiveRuns={activeRuns}
    />
  );
}
