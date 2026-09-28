"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon?: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {/* Illustration or Icon */}
      {illustration ? (
        <div className="mb-6">{illustration}</div>
      ) : IconComponent ? (
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900">
          <IconComponent
            size={40}
            weight="light"
            className="text-neutral-400 dark:text-neutral-600"
          />
        </div>
      ) : null}

      {/* Title */}
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && <div className="flex gap-3">{action}</div>}
    </div>
  );
}
