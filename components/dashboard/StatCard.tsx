"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  icon: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Main content */}
      <div className="flex items-start justify-between p-5">
        <div className="space-y-2">
          {/* Label */}
          <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">
            {label}
          </p>

          {/* Value */}
          <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50">
            {value}
          </p>
        </div>

        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
          {icon}
        </div>
      </div>

      {/* Divider + Change indicator */}
      {change && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 px-5 py-4">
          <p className="text-sm">
            <span
              className={cn(
                "font-medium",
                change.trend === "up" && "text-[#00a63e] dark:text-green-400",
                change.trend === "down" && "text-red-600 dark:text-red-400",
                change.trend === "neutral" &&
                  "text-neutral-500 dark:text-neutral-400",
              )}
            >
              {change.value}
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              {" "}
              from last month
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
