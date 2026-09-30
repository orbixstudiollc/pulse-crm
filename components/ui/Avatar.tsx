"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type AvatarStatus = "online" | "offline" | "away" | "busy";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: AvatarStatus;
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

const statusSizes = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
};

const statusColors: Record<AvatarStatus, string> = {
  online: "bg-success-fill",
  offline: "bg-fg-muted",
  away: "bg-warning",
  busy: "bg-danger",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({
  src,
  name,
  size = "md",
  status,
  className,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showInitials = !src || imageError;

  return (
    <div className={cn("relative inline-block", className)}>
      {showInitials ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-fg-secondary",
            sizeClasses[size],
          )}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div
          className={cn(
            "relative shrink-0 rounded-full overflow-hidden border border-line",
            sizeClasses[size],
          )}
        >
          <Image
            src={src}
            alt={name}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface",
            statusSizes[size],
            statusColors[status],
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AvatarGroup({
  children,
  max = 3,
  size = "md",
  className,
}: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const displayedChildren = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayedChildren}
      {remaining > 0 && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border border-line ring-2 ring-surface bg-muted font-medium text-fg-secondary",
            sizeClasses[size],
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
