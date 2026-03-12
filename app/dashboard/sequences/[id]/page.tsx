import {
  getSequenceById,
  getSequenceSteps,
  getSequenceEnrollments,
  getSequenceAnalytics,
} from "@/lib/actions/sequences";
import { SequenceDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seqRes, stepsRes, enrollRes, analyticsRes] = await Promise.all([
    getSequenceById(id),
    getSequenceSteps(id),
    getSequenceEnrollments(id),
    getSequenceAnalytics(id),
  ]);

  if (!seqRes.data) notFound();

  return (
    <SequenceDetailClient
      sequence={seqRes.data}
      steps={stepsRes.data}
      enrollments={enrollRes.data}
      analytics={analyticsRes.data}
    />
  );
}
