"use client";

import { useState } from "react";
import { PlatformType, PlatformConnection } from "@/lib/postpeer/types";
import { PlatformIcon } from "./PlatformIcon";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

interface PlatformSelectorProps {
  connections: PlatformConnection[];
  selectedPlatforms: PlatformType[];
  onChange: (platforms: PlatformType[]) => void;
  className?: string;
}

const ALL_PLATFORMS: PlatformType[] = [
  "twitter",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "bluesky",
  "threads",
];

const PLATFORM_LABELS: Record<PlatformType, string> = {
  twitter: "Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  threads: "Threads",
};

export function PlatformSelector({
  connections,
  selectedPlatforms,
  onChange,
  className,
}: PlatformSelectorProps) {
  const connectedPlatforms = new Set(
    connections.filter((c) => c.status === "connected").map((c) => c.platform),
  );

  const getConnectionCount = (platform: PlatformType) => {
    return connections.filter(
      (c) => c.platform === platform && c.status === "connected",
    ).length;
  };

  const togglePlatform = (platform: PlatformType) => {
    if (!connectedPlatforms.has(platform)) return;

    if (selectedPlatforms.includes(platform)) {
      onChange(selectedPlatforms.filter((p) => p !== platform));
    } else {
      onChange([...selectedPlatforms, platform]);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-3 gap-3">
        {ALL_PLATFORMS.map((platform) => {
          const isConnected = connectedPlatforms.has(platform);
          const isSelected = selectedPlatforms.includes(platform);
          const connectionCount = getConnectionCount(platform);

          return (
            <div
              key={platform}
              className={cn(
                "relative flex items-center gap-3 p-4 rounded-lg border transition-all",
                isConnected
                  ? "cursor-pointer hover:border-accent"
                  : "cursor-not-allowed opacity-50",
                isSelected
                  ? "border-accent bg-accent-surface"
                  : "border-line bg-surface",
              )}
              onClick={() => isConnected && togglePlatform(platform)}
            >
              <Checkbox
                checked={isSelected}
                disabled={!isConnected}
                onChange={() => {}}
                className="pointer-events-none"
              />
              <PlatformIcon platform={platform} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-fg">
                  {PLATFORM_LABELS[platform]}
                </div>
                {isConnected ? (
                  <div className="text-xs text-fg-secondary">
                    {connectionCount} account{connectionCount !== 1 ? "s" : ""}
                  </div>
                ) : (
                  <a
                    href={`/settings/integrations?connect=${platform}`}
                    className="text-xs text-accent-strong hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
