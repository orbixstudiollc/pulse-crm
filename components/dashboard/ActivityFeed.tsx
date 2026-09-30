"use client";

import Link from "next/link";
import { ArrowUpRightIcon, Badge, type BadgeVariant } from "@/components/ui";
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

const activityIcons: Record<ActivityType, ReactNode> = {
  email: <EnvelopeIcon size={14} />,
  call: <PhoneIcon size={14} />,
  note: <NoteIcon size={14} />,
  meeting: <CalendarCheckIcon size={14} />,
  task: <CheckCircleIcon size={14} />,
};

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: "Completed", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  pending: { label: "Pending", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "warning" },
};

export function ActivityFeed({
  activities = [],
  className,
}: ActivityFeedProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h3 className="text-heading-md text-fg">
          Activity Feed
        </h3>

        <Link
          href="/dashboard/activity"
          aria-label="View all activity"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-secondary transition-colors duration-150 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <ArrowUpRightIcon size={16} className="text-fg-secondary" />
        </Link>
      </div>

      {/* Activities */}
      <div>
        {activities.length > 0 ? (
          activities.map((activity, index) => {
            const status = statusConfig[activity.status] || { label: activity.status, variant: "info" as BadgeVariant };
            return (
              <div
                key={activity.id}
                className={cn(
                  "flex gap-3 px-4 py-3 hover:bg-subtle transition-colors",
                  index !== activities.length - 1 &&
                    "border-b border-row",
                )}
              >
                {/* Icon */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-subtle text-fg-secondary">
                  {activityIcons[activity.type] || activityIcons.note}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium text-fg truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-fg-secondary truncate">
                      {activity.description || activity.related_name || ""}
                    </p>
                  </div>

                  {/* Status + Time */}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                    <span className="text-xs text-fg-muted">
                      •
                    </span>
                    <span className="text-xs text-fg-secondary">
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-fg-secondary">
              No recent activity
            </p>
            <p className="text-xs text-fg-secondary mt-1">
              Activities will appear here as you work
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
