import { getObjections } from "@/lib/actions/objections";
import { PlaybookPageClient } from "./client";

export default async function PlaybookPage() {
  const { data: objections } = await getObjections();
  return <PlaybookPageClient initialObjections={objections} />;
}
