"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; icon?: ReactNode; count?: number | string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  /** sm fits narrow columns (e.g. the inbox list pane). */
  size?: "sm" | "md";
  "aria-label"?: string;
}

// Clay joined segment group: active segment gets a 1px accent outline, never a fill.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex", className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md border bg-surface transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:z-20",
              size === "sm"
                ? "h-7 gap-1 px-2.5 text-[13px] [&_svg]:size-3.5"
                : "h-8 gap-1.5 px-4 text-[14px] [&_svg]:size-4",
              isActive ? "relative z-10 rounded-md border-accent text-accent-strong" : "border-line text-fg",
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && <span className="text-fg-muted">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
