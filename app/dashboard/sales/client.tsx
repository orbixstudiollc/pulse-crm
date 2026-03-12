"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import Image from "next/image";
import { Button, Badge, Progress, PlusIcon, FadersIcon } from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import {
  AddDealModal,
  DealDrawer,
  FilterDealsModal,
} from "@/components/features";
import {
  type DealFilters,
  defaultFilters,
  getActiveFilterCount,
} from "@/components/features/FilterDealsModal";
import {
  pipelineStages,
  formatDealCurrency,
  type PipelineStage,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";
import { createDeal, updateDealStage } from "@/lib/actions/deals";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  TrendUpIcon,
  CrosshairIcon,
  TrophyIcon,
  MagnifyingGlassIcon,
} from "@/components/ui/Icons";

interface DealRecord {
  id: string;
  name: string;
  company: string | null;
  contact_name?: string | null;
  value: number;
  stage: string;
  probability: number;
  close_date?: string | null;
  owner_avatar?: string | null;
  created_at: string;
  days_in_stage?: number | null;
  stage_changed_at?: string | null;
  [key: string]: unknown;
}

type MappedDeal = {
  id: string;
  name: string;
  company: string;
  contactName: string;
  value: number;
  stage: PipelineStage;
  probability: number;
  closeDate: string;
  ownerAvatar: string;
  createdAt: string;
  daysInStage: number;
};

// Map DB deal to display shape
function mapDeal(d: DealRecord): MappedDeal {
  // Compute days in current stage
  let daysInStage = 0;
  if (d.days_in_stage != null) {
    daysInStage = d.days_in_stage;
  } else if (d.stage_changed_at) {
    daysInStage = Math.floor(
      (Date.now() - new Date(d.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24),
    );
  } else {
    daysInStage = Math.floor(
      (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    id: d.id,
    name: d.name || "",
    company: d.company || "",
    contactName: d.contact_name || "",
    value: d.value || 0,
    stage: (d.stage || "discovery") as PipelineStage,
    probability: d.probability || 0,
    closeDate: d.close_date
      ? new Date(d.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "",
    ownerAvatar: d.owner_avatar || "/images/avatars/user.jpg",
    createdAt: d.created_at,
    daysInStage,
  };
}

// Active stages
const activeStageIds: PipelineStage[] = ["discovery", "proposal", "negotiation"];
const closedStageIds: PipelineStage[] = ["closed_won", "closed_lost"];

const stageColors: Record<PipelineStage, string> = {
  discovery: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-violet-500",
  closed_won: "bg-green-500",
  closed_lost: "bg-red-500",
};

function getProbabilityColor(probability: number): "green" | "amber" | "neutral" {
  if (probability >= 60) return "green";
  if (probability >= 40) return "amber";
  return "neutral";
}

// ─── Pipeline Stats ──────────────────────────────────────────────────────────

function PipelineStats({ deals }: { deals: MappedDeal[] }) {
  const activeDeals = deals.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
  );
  const closedWon = deals.filter((d) => d.stage === "closed_won");
  const closedLost = deals.filter((d) => d.stage === "closed_lost");

  const totalValue = activeDeals.reduce((sum, d) => sum + d.value, 0);
  const weightedValue = activeDeals.reduce(
    (sum, d) => sum + d.value * (d.probability / 100),
    0,
  );
  const avgDealSize = activeDeals.length > 0 ? totalValue / activeDeals.length : 0;
  const closedTotal = closedWon.length + closedLost.length;
  const winRate = closedTotal > 0 ? Math.round((closedWon.length / closedTotal) * 100) : 0;

  const stats = [
    { label: "Pipeline Value", value: formatDealCurrency(totalValue), icon: CurrencyDollarIcon },
    { label: "Weighted Value", value: formatDealCurrency(weightedValue), icon: TrendUpIcon },
    { label: "Active Deals", value: activeDeals.length.toString(), icon: ChartBarIcon },
    { label: "Avg Deal Size", value: formatDealCurrency(avgDealSize), icon: CrosshairIcon },
    { label: "Win Rate", value: `${winRate}%`, icon: TrophyIcon },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3"
        >
          <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <stat.icon size={16} className="text-neutral-500 dark:text-neutral-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {stat.label}
            </p>
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function DroppableColumn({
  stageId,
  children,
  label,
  count,
  totalValue,
  onAddDeal,
}: {
  stageId: PipelineStage;
  children: React.ReactNode;
  label: string;
  count: number;
  totalValue: number;
  onAddDeal: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-72 sm:min-w-85 flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 transition-colors",
        isOver && "border-neutral-400 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800/50",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
            {label}
          </h3>
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-xs font-semibold text-white",
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
          onClick={onAddDeal}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-neutral-300 dark:border-neutral-700 py-2.5 text-sm text-neutral-400 dark:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
        >
          <PlusIcon size={16} />
        </button>
      </div>

      {/* Deal Cards */}
      <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto min-h-[100px]">
        {children}
      </div>
    </div>
  );
}

// ─── Draggable Deal Card ─────────────────────────────────────────────────────

function DraggableDealCard({
  deal,
  onClick,
}: {
  deal: MappedDeal;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <DealCard deal={deal} onClick={onClick} />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SalesPageClient({
  initialDeals,
}: {
  initialDeals: DealRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<MappedDeal | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DealFilters>(defaultFilters);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [localStageOverrides, setLocalStageOverrides] = useState<Record<string, PipelineStage>>({});

  const activeFilterCount = getActiveFilterCount(filters);
  const allDeals = useMemo(() => {
    const mapped = initialDeals.map(mapDeal);
    // Apply optimistic stage overrides
    const withOverrides = mapped.map((d) =>
      localStageOverrides[d.id] ? { ...d, stage: localStageOverrides[d.id] } : d,
    );

    // Apply filters
    return withOverrides.filter((deal) => {
      // Search filter
      if (filters.search?.trim()) {
        const q = filters.search.toLowerCase();
        if (
          !deal.name.toLowerCase().includes(q) &&
          !deal.company.toLowerCase().includes(q) &&
          !deal.contactName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Deal value filter
      if (filters.dealValue && filters.dealValue !== "any") {
        const minValues: Record<string, number> = { "10k": 10000, "25k": 25000, "50k": 50000 };
        const minVal = minValues[filters.dealValue] || 0;
        if (deal.value < minVal) return false;
      }

      // Probability filter
      if (filters.probability?.length > 0) {
        const p = deal.probability;
        const matches = filters.probability.some((band) => {
          if (band === "low") return p <= 30;
          if (band === "medium") return p > 30 && p <= 60;
          if (band === "high") return p > 60;
          return false;
        });
        if (!matches) return false;
      }

      // Close date filter
      if (filters.closeDate && filters.closeDate !== "any" && deal.closeDate) {
        const now = new Date();
        const rawDeal = initialDeals.find((r) => r.id === deal.id);
        if (rawDeal?.close_date) {
          const closeDate = new Date(rawDeal.close_date);
          if (filters.closeDate === "this_week") {
            const weekEnd = new Date(now);
            weekEnd.setDate(now.getDate() + (7 - now.getDay()));
            if (closeDate > weekEnd) return false;
          } else if (filters.closeDate === "this_month") {
            if (
              closeDate.getMonth() !== now.getMonth() ||
              closeDate.getFullYear() !== now.getFullYear()
            ) {
              return false;
            }
          } else if (filters.closeDate === "this_quarter") {
            const quarter = Math.floor(now.getMonth() / 3);
            const dealQuarter = Math.floor(closeDate.getMonth() / 3);
            if (dealQuarter !== quarter || closeDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [initialDeals, localStageOverrides, filters]);

  const activeDeals = allDeals.filter((d) => activeStageIds.includes(d.stage));
  const closedDeals = allDeals.filter((d) => closedStageIds.includes(d.stage));

  const visibleStages = activeTab === "active" ? activeStageIds : closedStageIds;

  const getDealsByStage = useCallback(
    (stage: PipelineStage) => allDeals.filter((d) => d.stage === stage),
    [allDeals],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeDeal = useMemo(
    () => (activeDragId ? allDeals.find((d) => d.id === activeDragId) ?? null : null),
    [activeDragId, allDeals],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const newStage = over.id as PipelineStage;
      const deal = allDeals.find((d) => d.id === dealId);
      if (!deal || deal.stage === newStage) return;

      // Optimistic update
      setLocalStageOverrides((prev) => ({ ...prev, [dealId]: newStage }));

      startTransition(async () => {
        const result = await updateDealStage(dealId, newStage);
        if (result.error) {
          // Revert on error
          setLocalStageOverrides((prev) => {
            const next = { ...prev };
            delete next[dealId];
            return next;
          });
          toast.error("Failed to move deal");
        } else {
          // Clear override and refresh server data
          setLocalStageOverrides((prev) => {
            const next = { ...prev };
            delete next[dealId];
            return next;
          });
          toast.success(`Moved to ${pipelineStages.find((s) => s.id === newStage)?.label}`);
          router.refresh();
        }
      });
    },
    [allDeals, router, startTransition],
  );

  const handleAddDeal = async (data: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await createDeal({
        name: data.dealName || data.name,
        company: data.company,
        contact_name: data.contactName || data.customer,
        value: parseFloat(data.value as string) || 0,
        stage: data.stage || "discovery",
        probability: parseInt(data.probability as string) || 30,
        close_date: data.closeDate || data.expectedClose,
      });
      if (!result.error) {
        setShowAddDeal(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 flex flex-col gap-4 min-h-full">
      {/* Header */}
      <PageHeader title="Sales Pipeline">
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
      </PageHeader>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Search deals..."
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          className="w-full sm:w-72 pl-9 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500/50"
        />
      </div>

      {/* Pipeline Stats */}
      <PipelineStats deals={allDeals} />

      {/* Tabs */}
      <div className="flex items-center rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-1 w-fit">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
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
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
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

      {/* Kanban Board with DnD */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {visibleStages.map((stageId) => {
            const stage = pipelineStages.find((s) => s.id === stageId)!;
            const deals = getDealsByStage(stageId);
            const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

            return (
              <DroppableColumn
                key={stageId}
                stageId={stageId}
                label={stage?.label ?? stageId}
                count={deals.length}
                totalValue={totalValue}
                onAddDeal={() => setShowAddDeal(true)}
              >
                {deals.map((deal) => (
                  <DraggableDealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => {
                      setSelectedDeal(deal);
                      setShowDrawer(true);
                    }}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDeal && (
            <div className="rotate-2 scale-105">
              <DealCard deal={activeDeal} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create Deal Modal */}
      <AddDealModal
        open={showAddDeal}
        onClose={() => setShowAddDeal(false)}
        mode="add"
        onSubmit={(data) => {
          handleAddDeal(data as unknown as Record<string, unknown>);
        }}
      />

      {/* Deal Quick View Drawer */}
      <DealDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        deal={selectedDeal as unknown as import("@/lib/data/sales").PipelineDeal | null}
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
  deal: MappedDeal;
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
        <div className="min-w-0 flex-1 mr-3 space-y-1">
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
            {deal.name}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {deal.company}
          </p>
          {deal.contactName && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
              {deal.contactName}
            </p>
          )}
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
            <div className="flex items-center gap-4">
              <Progress
                value={deal.probability}
                color={getProbabilityColor(deal.probability)}
                size="sm"
                className="w-16"
              />
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {deal.probability}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {deal.daysInStage > 0 && (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                deal.daysInStage > 30
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : deal.daysInStage > 14
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
              )}
            >
              {deal.daysInStage}d
            </span>
          )}
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {deal.closeDate}
          </span>
          <div className="relative h-8 w-8 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
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
