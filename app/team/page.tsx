import { TeamPageClient } from "./client";

export default async function TeamPage() {
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

  return <TeamPageClient initialData={teamData} />;
}
