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
          "flex items-center justify-center rounded-md border border-line bg-surface text-fg-secondary transition-colors duration-150 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-50",
          {
            "h-7 w-7": size === "sm",
            "h-8 w-8": size === "md",
            "h-10 w-10": size === "lg",
          },
          className,
        )}
        {...props}
      >
        <span className="relative">
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-surface bg-accent-strong px-1 text-xs font-semibold leading-none text-on-inverse">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
