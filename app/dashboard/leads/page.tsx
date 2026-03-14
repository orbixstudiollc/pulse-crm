import { getLeads } from "@/lib/actions/leads";
import { LeadsPageClient } from "./client";

export default async function LeadsPage() {
  const { data, count } = await getLeads({ perPage: 100 });
  // Pass as JSON string to bypass RSC serialization depth limits on nested JSONB data
  const serialized = JSON.stringify(data ?? []);

  return <LeadsPageClient initialLeadsJson={serialized} initialCount={count} />;
}
