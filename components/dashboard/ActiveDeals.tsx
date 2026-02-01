"use client";

import { useState } from "react";
import { ArrowUpRightIcon, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface DealStage {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface ActiveDealsProps {
  total?: number;
  dealCount?: number;
  stages?: DealStage[];
  className?: string;
}

const defaultStages: DealStage[] = [
  { name: "Discovery", value: 45000, count: 8, color: "bg-blue-500" },
  { name: "Proposal", value: 82500, count: 6, color: "bg-violet-500" },
  { name: "Negotiation", value: 124000, count: 5, color: "bg-amber-400" },
  { name: "Won", value: 67200, count: 4, color: "bg-green-500" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ActiveDeals({
  total = 318700,
  dealCount = 42,
  stages = defaultStages,
  className,
}: ActiveDealsProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const totalValue = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Active Deals
        </h3>

        <IconButton
          icon={<ArrowUpRightIcon size={20} />}
          aria-label="View all deals"
        />
      </div>

      {/* Content */}
      <div className="px-5 py-5 space-y-4">
        {/* Total */}
        <div className="space-y-1">
          <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
            {formatCurrency(total)}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {dealCount} deals in pipeline
          </p>
        </div>

        {/* Pipeline Bar */}
        <div className="flex gap-1 h-8">
          {stages.map((stage) => {
            const percentage = (stage.value / totalValue) * 100;
            const isHovered = hoveredStage === stage.name;
            const isOtherHovered =
              hoveredStage !== null && hoveredStage !== stage.name;

            return (
              <div
                key={stage.name}
                className={cn(
                  stage.color,
                  "rounded-lg transition-all duration-200 cursor-pointer",
                  isHovered && "scale-y-110 brightness-110",
                  isOtherHovered && "opacity-40",
                )}
                style={{ width: `${percentage}%` }}
                onMouseEnter={() => setHoveredStage(stage.name)}
                onMouseLeave={() => setHoveredStage(null)}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2">
          {stages.map((stage, index) => {
            const isHovered = hoveredStage === stage.name;
            const isOtherHovered =
              hoveredStage !== null && hoveredStage !== stage.name;

            return (
              <div
                key={stage.name}
                className={cn(
                  "flex items-center justify-between transition-opacity duration-200 cursor-pointer",
                  index === stages.length - 1 ? "pt-3" : "py-4",
                  index === 0 &&
                    "border-t-[0.5px] border-b-[0.5px] border-neutral-200 dark:border-neutral-800",
                  index !== 0 &&
                    index !== stages.length - 1 &&
                    "border-b-[0.5px] border-neutral-200 dark:border-neutral-800",
                  isOtherHovered && "opacity-40",
                )}
                onMouseEnter={() => setHoveredStage(stage.name)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 w-4 rounded-sm transition-transform duration-200",
                      stage.color,
                      isHovered && "scale-125",
                    )}
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {formatCurrency(stage.value)}
                  </span>
                  <span className="text-sm text-neutral-400 dark:text-neutral-500">
                    ({stage.count})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
