import {
  getLeadById,
  getLeadNotes,
  getLeadActivities,
} from "@/lib/actions/leads";
import { getLeadScoreHistory } from "@/lib/actions/scoring";
import { getQualificationData } from "@/lib/actions/qualification";
import { LeadDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [leadRes, notesRes, activitiesRes, scoreHistoryRes, qualRes] = await Promise.all([
    getLeadById(id),
    getLeadNotes(id),
    getLeadActivities(id),
    getLeadScoreHistory(id),
    getQualificationData(id),
  ]);

  if (!leadRes.data) {
    notFound();
  }

  return (
    <LeadDetailClient
      lead={leadRes.data}
      notes={notesRes.data}
      activities={activitiesRes.data}
      scoreHistory={scoreHistoryRes.data}
      qualificationData={qualRes.data ?? undefined}
    />
  );
}
