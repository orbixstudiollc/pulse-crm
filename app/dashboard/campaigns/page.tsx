import { getCampaignsWithTags, getCampaignDashboardStats, getCampaignTags, getEmailAccounts } from "@/lib/actions/campaigns";
import { CampaignsPageClient } from "./client";

export default async function CampaignsPage() {
  const [
    { data: campaigns },
    { data: stats },
    { data: tags },
    { data: accounts },
  ] = await Promise.all([
    getCampaignsWithTags(),
    getCampaignDashboardStats(),
    getCampaignTags(),
    getEmailAccounts(),
  ]);

  return (
    <CampaignsPageClient
      initialCampaigns={campaigns}
      initialStats={stats}
      initialTags={tags}
      initialAccounts={accounts}
    />
  );
}
