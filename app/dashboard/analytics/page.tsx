import {
  getPipelineVelocity,
  getLeadSourcePerformance,
  getSalesForecast,
  getWinLossAnalysis,
  getActivityMetrics,
  getConversionFunnel,
  getSequencePerformance,
  getICPPerformance,
  getChannelAnalytics,
} from "@/lib/actions/analytics";
import {
  getEmailOverviewStats,
  getAccountHealth,
  getDailyEmailVolume,
} from "@/lib/actions/email-analytics";
import { AnalyticsPageClient } from "./client";

export default async function AnalyticsPage() {
  const [pipeline, sources, forecast, winLoss, activities, funnel, sequences, icp, emailOverview, emailAccounts, emailVolume, channelData] =
    await Promise.all([
      getPipelineVelocity(),
      getLeadSourcePerformance(),
      getSalesForecast(),
      getWinLossAnalysis(),
      getActivityMetrics(),
      getConversionFunnel(),
      getSequencePerformance(),
      getICPPerformance(),
      getEmailOverviewStats(),
      getAccountHealth(),
      getDailyEmailVolume(),
      getChannelAnalytics(),
    ]);

  return (
    <AnalyticsPageClient
      pipeline={pipeline.data}
      sources={sources.data}
      forecast={forecast.data}
      winLoss={winLoss.data}
      activities={activities.data}
      funnel={funnel.data}
      sequences={sequences.data}
      icp={icp.data}
      email={{
        overview: emailOverview.data,
        accounts: emailAccounts.data,
        dailyVolume: emailVolume.data,
      }}
      channels={channelData.data}
    />
  );
}
