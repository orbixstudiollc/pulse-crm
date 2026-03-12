import { getSequences } from "@/lib/actions/sequences";
import { SequencesPageClient } from "./client";

export default async function SequencesPage() {
  const { data: sequences } = await getSequences();
  return <SequencesPageClient initialSequences={sequences} />;
}
