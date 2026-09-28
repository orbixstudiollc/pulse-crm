import { DraftsPageClient } from "./client";

export const metadata = {
  title: "Drafts | Pulse CRM",
  description: "Manage your draft posts",
};

export default async function DraftsPage() {
  // Server component - no data fetching needed as drafts are stored locally
  return <DraftsPageClient />;
}
