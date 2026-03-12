import { getLeads } from "@/lib/actions/leads";
import { LeadsPageClient } from "./client";

export default async function LeadsPage() {
  const { data, count } = await getLeads({ perPage: 100 });

  return <LeadsPageClient initialLeads={data} initialCount={count} />;
}
