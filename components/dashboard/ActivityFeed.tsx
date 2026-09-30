"use client";

import { Badge, type BadgeVariant } from "@/components/ui";
import {
  EnvelopeIcon,
  PhoneIcon,
  NoteIcon,
  CalendarCheckIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
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
    <div className={className}>
      {activities.length > 0 ? (
        activities.map((activity) => {
          const status = statusConfig[activity.status] || { label: activity.status, variant: "info" as BadgeVariant };
          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 border-b border-divider px-8 py-3 transition-colors hover:bg-subtle max-sm:px-4"
            >
              {/* Icon */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-subtle text-fg-secondary">
                {activityIcons[activity.type] || activityIcons.note}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-fg">
                  {activity.title}
                </p>
                <p className="truncate text-[13px] text-fg-muted">
                  {activity.description || activity.related_name || ""}
                </p>
              </div>

              {/* Status + Time */}
              <div className="flex shrink-0 items-center gap-3">
                <Badge variant={status.variant}>
                  {status.label}
                </Badge>
                <span className="w-20 text-right text-[13px] text-fg-muted">
                  {getRelativeTime(activity.created_at)}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[14px] font-medium text-fg">
            No recent activity
          </p>
          <p className="mt-1 text-[13px] text-fg-muted">
            Activities will appear here as you work
          </p>
        </div>
      )}
    </div>
  );
}
