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
      <p role="note" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Preview with sample data — social scheduling is not connected.</p>
      <TeamPageClient initialData={teamData} />
    </>
  );
}
