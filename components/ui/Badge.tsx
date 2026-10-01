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

// Contrast (light): success 4.71:1, warning 4.83:1, error 4.97:1, neutral 4.72:1,
// info/primary 4.49:1 (the one pair at the rounding edge of 4.5:1).
const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  error: "bg-danger-surface text-danger",
  info: "bg-accent-surface text-accent-on-surface",
  neutral: "bg-subtle text-fg-secondary",
  primary: "bg-accent-surface text-accent-on-surface",
};

const dotStyles: Record<BadgeVariant, string> = {
  success: "bg-success-fill",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-accent",
  neutral: "bg-fg-muted",
  primary: "bg-accent",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "h-5 px-1.5 text-xs",
  md: "h-5 px-2 text-xs",
  lg: "h-6 px-2.5 text-[13px]",
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
        "inline-flex items-center gap-1.5 rounded-sm font-medium",
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
          className="ml-0.5 -mr-0.5 inline-flex items-center justify-center rounded-full hover:bg-current/10 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current"
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
