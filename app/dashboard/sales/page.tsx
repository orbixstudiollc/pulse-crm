"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Button,
  Badge,
  Progress,
  PlusIcon,
  IconButton,
  FadersIcon,
} from "@/components/ui";
import {
  CreateDealModal,
  DealDrawer,
  FilterDealsModal,
} from "@/components/features";
import {
  type DealFilters,
  defaultFilters,
  getActiveFilterCount,
} from "@/components/features/FilterDealsModal";
import {
  pipelineDeals,
  pipelineStages,
  getDealsByStage,
  getStageTotalValue,
  getStageCount,
  formatDealCurrency,
  type PipelineStage,
  type PipelineDeal,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";

// Active stages (shown in "Active Pipeline" tab)
const activeStageIds: PipelineStage[] = [
  "discovery",
  "proposal",
  "negotiation",
];

// Closed stages (shown in "Closed Deals" tab)
const closedStageIds: PipelineStage[] = ["closed_won", "closed_lost"];

// Stage badge colors
const stageColors: Record<PipelineStage, string> = {
  discovery: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-violet-500",
  closed_won: "bg-green-500",
  closed_lost: "bg-red-500",
};

// Probability color based on value
function getProbabilityColor(
  probability: number,
): "green" | "amber" | "neutral" {
  if (probability >= 60) return "green";
  if (probability >= 40) return "amber";
  return "neutral";
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DealFilters>(defaultFilters);

  const activeFilterCount = getActiveFilterCount(filters);

  const activeDeals = pipelineDeals.filter((d) =>
    activeStageIds.includes(d.stage),
  );
  const closedDeals = pipelineDeals.filter((d) =>
    closedStageIds.includes(d.stage),
  );

  const visibleStages =
    activeTab === "active" ? activeStageIds : closedStageIds;

  return (
    <div className="py-6 px-8 flex flex-col gap-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
            Sales Pipeline
          </h1>

          {/* Tabs */}
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-1">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "active"
                  ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
              )}
            >
              Active Pipeline
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  activeTab === "active"
                    ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400",
                )}
              >
                {activeDeals.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("closed")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "closed"
                  ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
              )}
            >
              Closed Deals
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  activeTab === "closed"
                    ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400",
                )}
              >
                {closedDeals.length}
              </span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<FadersIcon size={18} />}
            onClick={() => setShowFilters(true)}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-950 dark:bg-neutral-50 px-1.5 text-xs font-semibold text-white dark:text-neutral-950">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            leftIcon={<PlusIcon size={20} weight="bold" />}
            onClick={() => setShowAddDeal(true)}
          >
            Add Deal
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {visibleStages.map((stageId) => {
          const stage = pipelineStages.find((s) => s.id === stageId)!;
          const deals = getDealsByStage(stageId);
          const totalValue = getStageTotalValue(stageId);
          const count = getStageCount(stageId);

          return (
            <div
              key={stageId}
              className="flex flex-col min-w-85 flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                    {stage.label}
                  </h3>
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-white",
                      stageColors[stageId],
                    )}
                  >
                    {count}
                  </span>
                </div>
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {formatDealCurrency(totalValue)}
                </span>
              </div>

              {/* Add Deal Button */}
              <div className="px-4 mb-3">
                <button
                  onClick={() => setShowAddDeal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 py-2.5 text-sm text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
                >
                  <PlusIcon size={16} />
                </button>
              </div>

              {/* Deal Cards */}
              <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
                {deals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => {
                      setSelectedDeal(deal);
                      setShowDrawer(true);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Deal Modal */}
      <CreateDealModal
        open={showAddDeal}
        onClose={() => setShowAddDeal(false)}
      />

      {/* Deal Quick View Drawer */}
      <DealDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        deal={selectedDeal}
      />

      {/* Filter Modal */}
      <FilterDealsModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  );
}

// ─── Deal Card ───────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onClick,
}: {
  deal: PipelineDeal;
  onClick: () => void;
}) {
  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";
  const isWon = deal.stage === "closed_won";

  return (
    <div
      onClick={onClick}
      className="rounded-xl border-[0.5px] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all cursor-pointer py-1"
    >
      {/* Top row: Name + Value */}
      <div className="flex items-start justify-between px-5 py-4">
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 truncate">
            {deal.name}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {deal.company}
          </p>
        </div>
        <p className="text-2xl font-serif font-medium text-neutral-950 dark:text-neutral-50 shrink-0">
          {formatDealCurrency(deal.value)}
        </p>
      </div>

      {/* Bottom row: Probability + Date + Avatar */}
      <div className="flex items-center justify-between px-5 py-4 border-t-[0.5px] border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          {isClosed ? (
            <Badge variant={isWon ? "green" : "red"} dot>
              {isWon ? "Won" : "Lost"}
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Progress
                value={deal.probability}
                color={getProbabilityColor(deal.probability)}
                size="sm"
                className="w-16"
              />
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {deal.probability}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {deal.closeDate}
          </span>
          <div className="relative h-7 w-7 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
            <Image
              src={deal.ownerAvatar}
              alt="Deal owner"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
