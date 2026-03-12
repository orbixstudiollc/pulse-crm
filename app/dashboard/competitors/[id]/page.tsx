import { getCompetitorById, getBattleCard } from "@/lib/actions/competitors";
import { CompetitorDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [competitorRes, battleCardRes] = await Promise.all([
    getCompetitorById(id),
    getBattleCard(id),
  ]);

  if (!competitorRes.data) {
    notFound();
  }

  return (
    <CompetitorDetailClient
      competitor={competitorRes.data}
      battleCard={battleCardRes.data}
    />
  );
}
