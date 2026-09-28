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
    bg: "bg-success-surface",
    border: "border-success",
    text: "text-success",
    dot: "bg-success-fill",
  },
  error: {
    bg: "bg-danger-surface",
    border: "border-danger",
    text: "text-danger",
    dot: "bg-danger",
  },
  pending: {
    bg: "bg-warning-surface",
    border: "border-warning",
    text: "text-warning",
    dot: "bg-warning",
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
