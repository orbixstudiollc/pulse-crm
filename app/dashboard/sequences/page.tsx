import { getSequencesWithKPIs } from "@/lib/actions/sequences";
import { SequencesPageClient } from "./client";

export default async function SequencesPage() {
  const { data: sequences } = await getSequencesWithKPIs();
  return <SequencesPageClient initialSequences={sequences} />;
}
