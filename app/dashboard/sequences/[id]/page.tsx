import {
  getSequenceById,
  getSequenceSteps,
  getSequenceEnrollments,
  getSequenceAnalytics,
  getSequenceKPIs,
  getSequenceStepMetrics,
  getSequenceDailyMetrics,
  getRecentSequenceActivity,
} from "@/lib/actions/sequences";
import { getActiveEmailAccounts } from "@/lib/actions/email-inbox";
import { SequenceDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seqRes, stepsRes, enrollRes, analyticsRes, kpisRes, stepMetricsRes, dailyMetricsRes, activityRes, accountsRes] =
    await Promise.all([
      getSequenceById(id),
      getSequenceSteps(id),
      getSequenceEnrollments(id),
      getSequenceAnalytics(id),
      getSequenceKPIs(id),
      getSequenceStepMetrics(id),
      getSequenceDailyMetrics(id),
      getRecentSequenceActivity(id),
      getActiveEmailAccounts(),
    ]);

  if (!seqRes.data) notFound();

  return (
    <SequenceDetailClient
      sequence={seqRes.data}
      steps={stepsRes.data}
      enrollments={enrollRes.data}
      analytics={analyticsRes.data}
      kpis={kpisRes.data}
      stepMetrics={stepMetricsRes.data}
      dailyMetrics={dailyMetricsRes.data}
      recentActivity={activityRes.data}
      emailAccounts={accountsRes.data ?? []}
    />
  );
}
