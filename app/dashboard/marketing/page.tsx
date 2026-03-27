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
      initialAudits={auditsRes.data as any}
      initialContent={contentRes.data as any}
      initialReports={reportsRes.data as any}
      initialActions={actionsRes.data as any}
    />
  );
}
