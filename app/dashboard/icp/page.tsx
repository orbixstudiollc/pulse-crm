import { getICPProfiles, getICPInsights } from "@/lib/actions/icp";
import { ICPClient } from "./client";

export default async function ICPPage() {
  const [profilesRes, insightsRes] = await Promise.all([
    getICPProfiles(),
    getICPInsights(),
  ]);

  return (
    <ICPClient
      profiles={profilesRes.data}
      insights={insightsRes.data}
    />
  );
}
