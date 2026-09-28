"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@phosphor-icons/react";
import { ArrowUpIcon, ArrowDownIcon } from "../ui/Icons";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: Icon;
  change?: {
    value: number;
    trend: "up" | "down";
  };
  trend?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: IconComponent,
  change,
  trend,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6",
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        </div>
        <div className="mt-4 h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 transition-shadow hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          {/* Label */}
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 truncate">
            {label}
          </p>

          {/* Value */}
          <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {value}
          </p>
        </div>

        {/* Icon */}
        {IconComponent && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-900">
            <IconComponent
              size={20}
              weight="regular"
              className="text-neutral-600 dark:text-neutral-400"
            />
          </div>
        )}
      </div>

      {/* Change Indicator or Trend */}
      <div className="mt-4 flex items-center gap-2">
        {change && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium",
              change.trend === "up"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {change.trend === "up" ? (
              <ArrowUpIcon size={14} weight="bold" />
            ) : (
              <ArrowDownIcon size={14} weight="bold" />
            )}
            <span>
              {Math.abs(change.value)}%
            </span>
          </div>
        )}

        {trend && (
          <div className="flex-1 min-w-0">
            {trend}
          </div>
        )}

        {change && (
          <span className="text-xs text-neutral-500 dark:text-neutral-500">
            vs last period
          </span>
        )}
      </div>
    </div>
  );
}
