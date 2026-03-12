import {
  getPipelineVelocity,
  getLeadSourcePerformance,
  getSalesForecast,
  getWinLossAnalysis,
  getActivityMetrics,
  getConversionFunnel,
  getSequencePerformance,
  getICPPerformance,
} from "@/lib/actions/analytics";
import { AnalyticsPageClient } from "./client";

export default async function AnalyticsPage() {
  const [pipeline, sources, forecast, winLoss, activities, funnel, sequences, icp] =
    await Promise.all([
      getPipelineVelocity(),
      getLeadSourcePerformance(),
      getSalesForecast(),
      getWinLossAnalysis(),
      getActivityMetrics(),
      getConversionFunnel(),
      getSequencePerformance(),
      getICPPerformance(),
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
    />
  );
}
