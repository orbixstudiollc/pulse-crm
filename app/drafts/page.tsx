import { getOrgId } from "@/lib/actions/helpers";
import { DraftsPageClient } from "./client";

export const metadata = {
  title: "Drafts | Pulse CRM",
  description: "Manage your draft posts",
};

export default async function DraftsPage() {
  await getOrgId();
  // Server component - no data fetching needed as drafts are stored locally
  return (
    <>
      <p role="note" className="mx-4 mt-4 rounded-lg border border-warning bg-warning-surface p-3 text-sm text-warning">Preview with sample data — social scheduling is not connected.</p>
      <DraftsPageClient />
    </>
  );
}
