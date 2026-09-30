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
      <p className="text-xs text-fg-secondary">
        {label}
      </p>

      {/* Value */}
      <p className="mt-1 text-[22px] leading-7 font-semibold text-fg">
        {value}
      </p>

      {/* Change indicator */}
      {change && (
        <p className="mt-2 text-xs">
          <span
            className={cn(
              "font-medium",
              change.trend === "up" && "text-success",
              change.trend === "down" && "text-danger",
              (change.trend === "neutral" || change.trend === "flat") && "text-fg-secondary",
            )}
          >
            {change.value}
          </span>
          <span className="text-fg-secondary">
            {" "}
            from last month
          </span>
        </p>
      )}

      {hint && (
        <p className="mt-2 text-xs text-fg-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
