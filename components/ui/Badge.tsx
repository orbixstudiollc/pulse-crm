"use client";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "primary";

type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  onRemove?: () => void;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success:
    "border-green-200 dark:border-green-400/30 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400",
  warning:
    "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400",
  error:
    "border-red-200 dark:border-red-400/30 bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400",
  info: "border-blue-200 dark:border-blue-400/30 bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400",
  neutral:
    "border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-700 dark:bg-neutral-400/15 dark:text-neutral-400",
  primary:
    "border-indigo-200 dark:border-indigo-400/30 bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-400",
};

const dotStyles: Record<BadgeVariant, string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-neutral-400 dark:bg-neutral-500",
  primary: "bg-indigo-500",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  onRemove,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[0.5px] font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])} />
      )}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current"
          aria-label="Remove"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
}
