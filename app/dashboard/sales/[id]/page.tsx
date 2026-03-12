import {
  getDealById,
  getDealNotes,
  getDealActivities,
} from "@/lib/actions/deals";
import { DealDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dealRes, notesRes, activitiesRes] = await Promise.all([
    getDealById(id),
    getDealNotes(id),
    getDealActivities(id),
  ]);

  if (!dealRes.data) {
    notFound();
  }

  return (
    <DealDetailClient
      deal={dealRes.data}
      notes={notesRes.data}
      activities={activitiesRes.data}
    />
  );
}
