import {
  getDealById,
  getDealNotes,
  getDealActivities,
} from "@/lib/actions/deals";
import { getLinkedItems } from "@/lib/actions/record-activities";
import { DealDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dealRes, notesRes, activitiesRes, linkedRes] = await Promise.all([
    getDealById(id),
    getDealNotes(id),
    getDealActivities(id),
    getLinkedItems("deal", id),
  ]);

  if (!dealRes.data) {
    notFound();
  }

  return (
    <DealDetailClient
      deal={dealRes.data}
      notes={notesRes.data}
      activities={activitiesRes.data}
      linkedItems={linkedRes.data}
    />
  );
}
