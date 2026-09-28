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
  online: "bg-green-500",
  offline: "bg-neutral-400",
  away: "bg-amber-500",
  busy: "bg-red-500",
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
            "flex shrink-0 items-center justify-center rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-700 bg-indigo-100 dark:bg-indigo-900/30 font-medium text-indigo-700 dark:text-indigo-400",
            sizeClasses[size],
          )}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div
          className={cn(
            "relative shrink-0 rounded-full overflow-hidden border-[0.5px] border-neutral-200 dark:border-neutral-700",
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
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-neutral-900",
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
            "flex shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-800 font-medium text-neutral-600 dark:text-neutral-400",
            sizeClasses[size],
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
