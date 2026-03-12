import { getCompetitors } from "@/lib/actions/competitors";
import { CompetitorsPageClient } from "./client";

export default async function CompetitorsPage() {
  const { data } = await getCompetitors();

  return <CompetitorsPageClient initialCompetitors={data} />;
}
