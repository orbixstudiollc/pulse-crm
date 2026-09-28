import { getConnections } from "@/lib/actions/connections";
import { ConnectionsPageClient } from "./client";
import { redirect } from "next/navigation";
import { getOrgId } from "@/lib/actions/helpers";

export default async function ConnectionsPage() {
  await getOrgId();
  const result = await getConnections();

  if (!result.success) {
    // If PostPeer is not configured, show empty state
    return <ConnectionsPageClient initialConnections={[]} />;
  }

  return <ConnectionsPageClient initialConnections={result.data || []} />;
}
