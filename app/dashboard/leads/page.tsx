import { getLeads } from "@/lib/actions/leads";
import { LeadsPageClient } from "./client";

export default async function LeadsPage() {
  const { data, count } = await getLeads({ perPage: 100 });
  // Sanitize to avoid "Maximum array nesting exceeded" in RSC serialization
  const safeData = JSON.parse(JSON.stringify(data ?? []));

  return <LeadsPageClient initialLeads={safeData} initialCount={count} />;
}
