import { getLeads } from "@/lib/actions/leads";
import { LeadsPageClient } from "./client";

// Stringify any nested object/array values to prevent RSC serialization depth errors
function flattenLead(lead: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(lead)) {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      flat[key] = JSON.stringify(value);
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

export default async function LeadsPage() {
  const { data, count } = await getLeads({ perPage: 100 });
  const safeData = (data ?? []).map((lead) => flattenLead(lead as Record<string, unknown>));

  return <LeadsPageClient initialLeads={safeData as typeof data} initialCount={count} />;
}
