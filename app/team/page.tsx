import { getOrgId } from "@/lib/actions/helpers";
import { TeamPageClient } from "./client";

export default async function TeamPage() {
  await getOrgId();
  // In a real implementation, this would fetch data from PostPeer API
  // For now, returning mock data structure that matches expected types

  const teamData = {
    plan: {
      name: "Professional",
      seatsUsed: 3,
      seatsTotal: 5,
    },
    members: [],
    pendingInvitations: [],
    activityLog: [],
  };

  return (
    <>
      <p role="note" className="mx-4 mt-4 rounded-lg border border-warning bg-warning-surface p-3 text-sm text-warning">Preview with sample data — social scheduling is not connected.</p>
      <TeamPageClient initialData={teamData} />
    </>
  );
}
