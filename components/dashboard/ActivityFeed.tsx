"use client";

import { ArrowUpRightIcon, Badge, IconButton } from "@/components/ui";
import {
  EnvelopeIcon,
  PhoneIcon,
  NoteIcon,
  CalendarCheckIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type ActivityType = "email" | "call" | "note" | "meeting" | "task";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  related_name: string | null;
}

interface ActivityFeedProps {
  activities?: Activity[];
  className?: string;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type BadgeVariant = "green" | "amber" | "blue" | "emerald";

const activityIcons: Record<ActivityType, ReactNode> = {
  email: <EnvelopeIcon size={16} />,
  call: <PhoneIcon size={16} />,
  note: <NoteIcon size={16} />,
  meeting: <CalendarCheckIcon size={16} />,
  task: <CheckCircleIcon size={16} />,
};

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: "Completed", variant: "emerald" },
  scheduled: { label: "Scheduled", variant: "blue" },
  pending: { label: "Pending", variant: "amber" },
  cancelled: { label: "Cancelled", variant: "amber" },
};

export function ActivityFeed({
  activities = [],
  className,
}: ActivityFeedProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-serif tracking-[-0.2px] text-neutral-950 dark:text-neutral-50">
          Activity Feed
        </h3>

        <IconButton
          icon={
            <ArrowUpRightIcon
              size={20}
              className="text-neutral-600 dark:text-neutral-400"
            />
          }
          aria-label="View all activity"
        />
      </div>

      {/* Activities */}
      <div>
        {activities.length > 0 ? (
          activities.map((activity, index) => {
            const status = statusConfig[activity.status] || { label: activity.status, variant: "blue" as BadgeVariant };
            return (
              <div
                key={activity.id}
                className={cn(
                  "flex gap-3 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors",
                  index !== activities.length - 1 &&
                    "border-b-[0.5px] border-neutral-200 dark:border-neutral-800",
                )}
              >
                {/* Icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400">
                  {activityIcons[activity.type] || activityIcons.note}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-neutral-700 dark:text-neutral-400 truncate">
                      {activity.description || activity.related_name || ""}
                    </p>
                  </div>

                  {/* Status + Time */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      •
                    </span>
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-500">
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No recent activity
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Activities will appear here as you work
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
