import { getProposalById } from "@/lib/actions/proposals";
import { getOrgId } from "@/lib/actions/helpers";
import { createClient } from "@/lib/supabase/server";
import { ProposalDetailClient } from "./client";
import { notFound } from "next/navigation";

async function getDealName(dealId: string): Promise<string | null> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data } = await supabase
    .from("deals")
    .select("id, name")
    .eq("id", dealId)
    .eq("organization_id", orgId)
    .maybeSingle();

  return data?.name ?? null;
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proposalRes = await getProposalById(id);
  const proposal = proposalRes.data;
  if (!proposal) {
    notFound();
  }

  const dealName = proposal.deal_id ? await getDealName(proposal.deal_id) : null;

  return <ProposalDetailClient proposal={proposal} dealName={dealName} />;
}
