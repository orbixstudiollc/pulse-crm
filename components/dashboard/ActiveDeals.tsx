"use client";

import { useState } from "react";
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
    <div className={className}>
      {/* Total */}
      <p className="flex items-baseline gap-2 border-b border-divider px-8 py-3 max-sm:px-4">
        <span className="text-[15px] leading-6 font-semibold text-fg">
          {formatCurrency(total)}
        </span>
        <span className="text-[13px] text-fg-muted">
          {dealCount} deal{dealCount !== 1 ? "s" : ""} in pipeline
        </span>
      </p>

      {stages.length > 0 ? (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="text-left">Stage</th>
                <th className="text-left">Deals</th>
                <th className="text-left">Value</th>
                <th className="w-[40%] text-left">Share</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => {
                const percentage = totalValue > 0 ? (stage.value / totalValue) * 100 : 0;
                const isHovered = hoveredStage === stage.name;
                const isOtherHovered =
                  hoveredStage !== null && hoveredStage !== stage.name;

                return (
                  <tr
                    key={stage.name}
                    className={cn(
                      "cursor-pointer transition-opacity duration-200",
                      isOtherHovered && "opacity-40",
                    )}
                    onMouseEnter={() => setHoveredStage(stage.name)}
                    onMouseLeave={() => setHoveredStage(null)}
                  >
                    <td className="text-[13px] text-fg">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full transition-transform duration-200",
                            stage.color,
                            isHovered && "scale-125",
                          )}
                        />
                        {stage.name}
                      </div>
                    </td>
                    <td className="text-[13px] text-fg-secondary">{stage.count}</td>
                    <td className="text-[13px] font-medium text-fg">
                      {formatCurrency(stage.value)}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-subtle">
                          <div
                            className={cn(stage.color, "h-full rounded-full")}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-[13px] text-fg-muted">
                          {Math.round(percentage)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[13px] font-medium text-fg">
            No active deals yet
          </p>
          <p className="mt-1 text-[13px] text-fg-muted">
            Create deals to see pipeline breakdown
          </p>
        </div>
      )}
    </div>
  );
}
