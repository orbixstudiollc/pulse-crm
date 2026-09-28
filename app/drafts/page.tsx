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
      <p role="note" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Preview with sample data — social scheduling is not connected.</p>
      <DraftsPageClient />
    </>
  );
}
