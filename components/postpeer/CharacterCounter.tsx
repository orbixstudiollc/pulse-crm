"use client";

import { PlatformType, PLATFORM_CAPABILITIES } from "@/lib/postpeer/types";
import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  text: string;
  selectedPlatforms: PlatformType[];
  className?: string;
}

export function CharacterCounter({
  text,
  selectedPlatforms,
  className,
}: CharacterCounterProps) {
  const textLength = text.length;

  if (selectedPlatforms.length === 0) {
    return null;
  }

  const platformLimits = selectedPlatforms.map((platform) => ({
    platform,
    limit: PLATFORM_CAPABILITIES[platform].maxTextLength,
  }));

  const minLimit = Math.min(...platformLimits.map((p) => p.limit));
  const isWarning = textLength > minLimit * 0.9;
  const isError = textLength > minLimit;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Character count
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            isError
              ? "text-red-600 dark:text-red-400"
              : isWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-neutral-700 dark:text-neutral-300",
          )}
        >
          {textLength} / {minLimit}
        </span>
      </div>

      {selectedPlatforms.length > 1 && (
        <div className="space-y-1">
          {platformLimits.map(({ platform, limit }) => {
            const isOverLimit = textLength > limit;
            const percentage = (textLength / limit) * 100;

            return (
              <div key={platform} className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 capitalize">
                  {platform}
                </span>
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      isOverLimit
                        ? "bg-red-500"
                        : percentage > 90
                          ? "bg-amber-500"
                          : "bg-green-500",
                    )}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium w-16 text-right",
                    isOverLimit
                      ? "text-red-600 dark:text-red-400"
                      : "text-neutral-600 dark:text-neutral-400",
                  )}
                >
                  {limit}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Text exceeds the character limit for one or more platforms
        </p>
      )}
      {!isError && isWarning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Approaching character limit
        </p>
      )}
    </div>
  );
}
