"use client";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "red"
  | "amber"
  | "green"
  | "blue"
  | "emerald"
  | "violet"
  | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  red: "border-red-200 dark:border-red-400/30 bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-400",
  amber:
    "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400",
  green:
    "border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400",
  blue: "border-blue-200 dark:border-blue-400/30 bg-blue-100 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400",
  emerald:
    "border-emerald-200 dark:border-emerald-400/30 bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
  violet:
    "border-violet-200 dark:border-violet-400/30 bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-400",
  neutral:
    "border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400",
};

const dotStyles: Record<BadgeVariant, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  neutral: "bg-neutral-400 dark:bg-neutral-500",
};

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-2.5 py-1 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}
