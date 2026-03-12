import { getWebsiteVisitors, getVisitorStats, getTrackingScripts } from "@/lib/actions/website-visitors";
import { WebsiteVisitorsClient } from "./client";

export default async function WebsiteVisitorsPage() {
  const [{ visitors, total }, stats, scripts] = await Promise.all([
    getWebsiteVisitors({ perPage: 50 }),
    getVisitorStats(),
    getTrackingScripts(),
  ]);

  return (
    <WebsiteVisitorsClient
      initialVisitors={visitors}
      initialTotal={total}
      initialStats={stats}
      initialScripts={scripts}
    />
  );
}
