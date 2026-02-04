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
type ActivityStatus =
  | "opened"
  | "positive"
  | "high"
  | "scheduled"
  | "completed";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  status: ActivityStatus;
  timestamp: string;
}

interface ActivityFeedProps {
  activities?: Activity[];
  className?: string;
}

const defaultActivities: Activity[] = [
  {
    id: "1",
    type: "email",
    title: "Email sent to John Smith",
    description: "Follow-up on product demo request",
    status: "opened",
    timestamp: "5 min ago",
  },
  {
    id: "2",
    type: "call",
    title: "Call with Emily Davis",
    description: "Discussed pricing options - very interested",
    status: "positive",
    timestamp: "12 min ago",
  },
  {
    id: "3",
    type: "note",
    title: "Note added for Michael Brown",
    description: "Decision maker confirmed, needs proposal by Friday",
    status: "high",
    timestamp: "12 min ago",
  },
  {
    id: "4",
    type: "meeting",
    title: "Meeting scheduled",
    description: "Demo call with GlobalTech team",
    status: "scheduled",
    timestamp: "Tomorrow, 2:00 PM",
  },
  {
    id: "5",
    type: "task",
    title: "Task completed",
    description: "Send proposal to TechStart Inc",
    status: "completed",
    timestamp: "3 hours ago",
  },
];

const activityIcons: Record<ActivityType, ReactNode> = {
  email: <EnvelopeIcon size={16} />,
  call: <PhoneIcon size={16} />,
  note: <NoteIcon size={16} />,
  meeting: <CalendarCheckIcon size={16} />,
  task: <CheckCircleIcon size={16} />,
};

const statusConfig: Record<
  ActivityStatus,
  { label: string; variant: "green" | "amber" | "blue" | "emerald" }
> = {
  opened: { label: "Opened", variant: "green" },
  positive: { label: "Positive", variant: "green" },
  high: { label: "High", variant: "amber" },
  scheduled: { label: "Scheduled", variant: "blue" },
  completed: { label: "Completed", variant: "emerald" },
};

export function ActivityFeed({
  activities = defaultActivities,
  className,
}: ActivityFeedProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
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
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className={cn(
              "flex gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors",
              index !== activities.length - 1 &&
                "border-b-[0.5px] border-neutral-200 dark:border-neutral-800",
            )}
          >
            {/* Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400">
              {activityIcons[activity.type]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                  {activity.title}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                  {activity.description}
                </p>
              </div>

              {/* Status + Time */}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant={statusConfig[activity.status].variant}>
                  {statusConfig[activity.status].label}
                </Badge>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  •
                </span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {activity.timestamp}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
