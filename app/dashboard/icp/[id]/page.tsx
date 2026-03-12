import { getICPProfileById, getLeadsByICPProfile } from "@/lib/actions/icp";
import { ICPDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function ICPDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profileRes, leadsRes] = await Promise.all([
    getICPProfileById(id),
    getLeadsByICPProfile(id),
  ]);

  if (!profileRes.data) notFound();

  return (
    <ICPDetailClient
      profile={profileRes.data}
      matchedLeads={leadsRes.data}
    />
  );
}
