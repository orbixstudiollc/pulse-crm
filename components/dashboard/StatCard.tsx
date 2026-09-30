"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral" | "flat";
  };
  hint?: string;
  icon: ReactNode;
  className?: string;
}

// Only numeric changes ("+12%", "-3", "5") read as "... from last month"; text like "New this month" stands alone.
const HAS_NUMERIC_CHANGE = /^[+-]?\d/;

// `icon` stays in the props so existing call sites compile; the flat tile does not render it.
export function StatCard({
  label,
  value,
  change,
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-4",
        className,
      )}
    >
      {/* Label */}
      <p className="text-[13px] text-fg-secondary">
        {label}
      </p>

      {/* Value */}
      <p className="mt-1 text-[22px] leading-7 font-semibold text-fg">
        {value}
      </p>

      {/* Change indicator */}
      {change && (
        <p className="mt-2 text-[13px]">
          <span
            className={cn(
              "font-medium",
              change.trend === "up" && "text-success",
              change.trend === "down" && "text-danger",
              (change.trend === "neutral" || change.trend === "flat") && "text-fg-muted",
            )}
          >
            {change.value}
          </span>
          {HAS_NUMERIC_CHANGE.test(change.value) && (
            <span className="text-fg-muted">
              {" "}
              from last month
            </span>
          )}
        </p>
      )}

      {hint && (
        <p className="mt-2 text-[13px] text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
