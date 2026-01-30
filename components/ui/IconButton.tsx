"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  badge?: number;
  size?: "sm" | "md" | "lg";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, badge, size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
          {
            "h-8 w-8": size === "sm",
            "h-11 w-11": size === "md",
            "h-12 w-12": size === "lg",
          },
          className,
        )}
        {...props}
      >
        <span className="relative">
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white dark:border-neutral-950 bg-neutral-950 dark:bg-neutral-50 text-[9px] font-semibold text-white dark:text-neutral-950">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
