"use client";

import { useState } from "react";
import { PlatformType, MediaFile } from "@/lib/postpeer/types";
import { PlatformIcon } from "./PlatformIcon";
import { cn } from "@/lib/utils";

interface PostPreviewProps {
  text: string;
  media: MediaFile[];
  selectedPlatforms: PlatformType[];
  className?: string;
}

export function PostPreview({
  text,
  media,
  selectedPlatforms,
  className,
}: PostPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<PlatformType | null>(
    selectedPlatforms[0] || null,
  );

  if (selectedPlatforms.length === 0) {
    return (
      <div className={cn("text-center py-8 text-fg-secondary", className)}>
        Select platforms to preview your post
      </div>
    );
  }

  const currentPlatform = activePlatform || selectedPlatforms[0];

  return (
    <div className={cn("space-y-4", className)}>
      {selectedPlatforms.length > 1 && (
        <div className="flex gap-2 border-b border-divider">
          {selectedPlatforms.map((platform) => (
            <button
              key={platform}
              onClick={() => setActivePlatform(platform)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b -mb-px",
                activePlatform === platform
                  ? "border-inverse text-fg"
                  : "border-transparent text-fg-secondary hover:text-fg",
              )}
            >
              <PlatformIcon platform={platform} size="sm" />
              <span className="capitalize">{platform}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-4">
        {renderPlatformPreview(currentPlatform, text, media)}
      </div>
    </div>
  );
}

function renderPlatformPreview(
  platform: PlatformType,
  text: string,
  media: MediaFile[],
) {
  const hasMedia = media.length > 0;

  switch (platform) {
    case "twitter":
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-active" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-fg">
                  Your Name
                </span>
                <span className="text-fg-secondary">@username</span>
                <span className="text-fg-secondary">·</span>
                <span className="text-fg-secondary">now</span>
              </div>
              <p className="text-fg whitespace-pre-wrap">
                {text || "Your post text will appear here..."}
              </p>
              {hasMedia && (
                <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
                  {media.slice(0, 4).map((item) => (
                    <img
                      key={item.id}
                      src={item.url}
                      alt=""
                      className="w-full h-32 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case "facebook":
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-active" />
            <div className="flex-1">
              <div className="font-semibold text-fg">
                Your Name
              </div>
              <div className="text-xs text-fg-secondary">Just now · 🌎</div>
            </div>
          </div>
          <p className="text-fg whitespace-pre-wrap">
            {text || "Your post text will appear here..."}
          </p>
          {hasMedia && (
            <div className="rounded-lg overflow-hidden border border-line">
              {media.slice(0, 1).map((item) => (
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="w-full h-64 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      );

    case "instagram":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-active" />
            <span className="font-semibold text-sm text-fg">
              your_username
            </span>
          </div>
          {hasMedia && (
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {media.slice(0, 1).map((item) => (
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ))}
            </div>
          )}
          <p className="text-sm text-fg">
            <span className="font-semibold">your_username</span>{" "}
            {text || "Your caption will appear here..."}
          </p>
        </div>
      );

    case "linkedin":
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-active" />
            <div className="flex-1">
              <div className="font-semibold text-fg">
                Your Name
              </div>
              <div className="text-xs text-fg-secondary">
                Your Title · Just now · 🌎
              </div>
            </div>
          </div>
          <p className="text-sm text-fg whitespace-pre-wrap">
            {text || "Your post text will appear here..."}
          </p>
          {hasMedia && (
            <div className="rounded-lg overflow-hidden border border-line">
              {media.slice(0, 1).map((item) => (
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="w-full h-64 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      );

    case "threads":
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-active" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-fg">
                  your_username
                </span>
              </div>
              <p className="text-sm text-fg whitespace-pre-wrap">
                {text || "Your thread will appear here..."}
              </p>
              {hasMedia && (
                <div className="rounded-lg overflow-hidden">
                  {media.slice(0, 1).map((item) => (
                    <img
                      key={item.id}
                      src={item.url}
                      alt=""
                      className="w-full h-48 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-active" />
            <div className="flex-1">
              <div className="font-semibold text-fg">
                Your Name
              </div>
              <div className="text-xs text-fg-secondary">Just now</div>
            </div>
          </div>
          <p className="text-fg whitespace-pre-wrap">
            {text || "Your post text will appear here..."}
          </p>
          {hasMedia && (
            <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
              {media.slice(0, 4).map((item) => (
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="w-full h-32 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      );
  }
}
