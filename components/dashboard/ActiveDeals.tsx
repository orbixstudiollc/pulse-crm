"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/ui";
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ActiveDeals({
  total = 0,
  dealCount = 0,
  stages = [],
  className,
}: ActiveDealsProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const totalValue = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h3 className="text-heading-md text-fg">
          Active Deals
        </h3>

        <Link
          href="/dashboard/sales"
          aria-label="View all deals"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-secondary transition-colors duration-150 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <ArrowUpRightIcon size={20} />
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Total */}
        <div className="space-y-1">
          <p className="text-[22px] leading-7 font-semibold text-fg">
            {formatCurrency(total)}
          </p>
          <p className="text-[13px] text-fg-secondary">
            {dealCount} deal{dealCount !== 1 ? "s" : ""} in pipeline
          </p>
        </div>

        {stages.length > 0 ? (
          <>
            {/* Pipeline Bar */}
            <div className="flex gap-1 h-2">
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
                      "rounded-full transition-all duration-200 cursor-pointer",
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
            <div className="pt-1">
              {stages.map((stage, index) => {
                const isHovered = hoveredStage === stage.name;
                const isOtherHovered =
                  hoveredStage !== null && hoveredStage !== stage.name;

                return (
                  <div
                    key={stage.name}
                    className={cn(
                      "flex items-center justify-between transition-opacity duration-200 cursor-pointer py-2",
                      index < stages.length - 1 &&
                        "border-b border-row",
                      index === 0 &&
                        "border-t border-row",
                      isOtherHovered && "opacity-40",
                    )}
                    onMouseEnter={() => setHoveredStage(stage.name)}
                    onMouseLeave={() => setHoveredStage(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full transition-transform duration-200",
                          stage.color,
                          isHovered && "scale-125",
                        )}
                      />
                      <span className="text-[13px] text-fg">
                        {stage.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-fg">
                        {formatCurrency(stage.value)}
                      </span>
                      <span className="text-[13px] text-fg-secondary">
                        ({stage.count})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-fg-secondary">
              No active deals yet
            </p>
            <p className="text-xs text-fg-secondary mt-1">
              Create deals to see pipeline breakdown
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
