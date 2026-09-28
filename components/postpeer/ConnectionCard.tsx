"use client";

import { PlatformConnection, PlatformType } from "@/lib/postpeer/types";
import { PlatformIcon } from "./PlatformIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { UsersIcon } from "@/components/ui/Icons";

interface ConnectionCardProps {
  connection: PlatformConnection;
  onDisconnect?: (connectionId: string) => void;
  className?: string;
}

export function ConnectionCard({
  connection,
  onDisconnect,
  className,
}: ConnectionCardProps) {
  const statusVariant =
    connection.status === "connected"
      ? "success"
      : connection.status === "error"
        ? "error"
        : "warning";

  const statusLabel =
    connection.status === "connected"
      ? "Connected"
      : connection.status === "error"
        ? "Error"
        : "Pending";

  return (
    <Card
      className={cn(
        "p-4 hover:shadow-md transition-shadow",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <PlatformIcon platform={connection.platform} size="xl" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
                {connection.platform}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                @{connection.username}
              </p>
            </div>
            <Badge variant={statusVariant} dot>
              {statusLabel}
            </Badge>
          </div>

          {connection.displayName && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
              {connection.displayName}
            </p>
          )}

          {connection.stats && (
            <div className="flex gap-4 mb-3">
              {connection.stats.followers !== undefined && (
                <div className="text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {connection.stats.followers.toLocaleString()}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 ml-1">
                    followers
                  </span>
                </div>
              )}
              {connection.stats.following !== undefined && (
                <div className="text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {connection.stats.following.toLocaleString()}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 ml-1">
                    following
                  </span>
                </div>
              )}
              {connection.stats.posts !== undefined && (
                <div className="text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {connection.stats.posts.toLocaleString()}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 ml-1">
                    posts
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {connection.lastUsed ? (
                <>Last used {new Date(connection.lastUsed).toLocaleDateString()}</>
              ) : (
                <>Connected {new Date(connection.connectedAt).toLocaleDateString()}</>
              )}
            </div>

            {onDisconnect && connection.status === "connected" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(connection.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                Disconnect
              </Button>
            )}
          </div>

          {connection.error && (
            <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-700 dark:text-red-400">
                {connection.error}
              </p>
            </div>
          )}
        </div>

        {connection.profilePicture && (
          <div className="flex-shrink-0">
            <img
              src={connection.profilePicture}
              alt={connection.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
