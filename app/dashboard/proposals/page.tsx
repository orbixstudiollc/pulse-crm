import { getProposals } from "@/lib/actions/proposals";
import { getDeals } from "@/lib/actions/deals";
import { ProposalsPageClient } from "./client";

export default async function ProposalsPage() {
  const [{ data }, { data: deals }] = await Promise.all([
    getProposals(),
    getDeals(),
  ]);
  return <ProposalsPageClient initialProposals={data} deals={deals} />;
}
