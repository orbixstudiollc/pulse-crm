import { getMarketingAudits, getMarketingContent, getMarketingReports, getMarketingActionItems } from "@/lib/actions/marketing";
import { MarketingPageClient } from "./client";

export default async function MarketingPage() {
  const [auditsRes, contentRes, reportsRes, actionsRes] = await Promise.all([
    getMarketingAudits(),
    getMarketingContent(),
    getMarketingReports(),
    getMarketingActionItems(),
  ]);

  return (
    <MarketingPageClient
      initialAudits={auditsRes.data.map((a) => ({ ...a, progress: a.progress ?? 0 }))}
      initialContent={contentRes.data}
      initialReports={reportsRes.data}
      initialActions={actionsRes.data}
    />
  );
}
