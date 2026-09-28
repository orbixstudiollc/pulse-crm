"use client";

import { PlatformType, ConnectionStatus } from "@/lib/postpeer/types";
import { PlatformIcon } from "./PlatformIcon";
import { cn } from "@/lib/utils";

interface PlatformBadgeProps {
  platform: PlatformType;
  status: ConnectionStatus;
  details?: string;
  className?: string;
}

const STATUS_STYLES = {
  connected: {
    bg: "bg-green-100 dark:bg-green-400/15",
    border: "border-green-200 dark:border-green-400/30",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-400/15",
    border: "border-red-200 dark:border-red-400/30",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
  pending: {
    bg: "bg-amber-100 dark:bg-amber-400/15",
    border: "border-amber-200 dark:border-amber-400/30",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

const STATUS_LABELS = {
  connected: "Connected",
  error: "Error",
  pending: "Pending",
};

export function PlatformBadge({
  platform,
  status,
  details,
  className,
}: PlatformBadgeProps) {
  const styles = STATUS_STYLES[status];
  const label = STATUS_LABELS[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
        styles.bg,
        styles.border,
        styles.text,
        className,
      )}
      title={details || label}
    >
      <PlatformIcon platform={platform} size="sm" />
      <span className="capitalize">{platform}</span>
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
    </div>
  );
}
