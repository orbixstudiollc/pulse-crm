"use client";

import { ReactNode } from "react";
import {
  Badge,
  ActionMenu,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  NoteIcon,
  VideoIcon,
  CurrencyDollarIcon,
  FileTextIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// Supported activity types
export type ActivityRowType =
  | "email"
  | "call"
  | "meeting"
  | "note"
  | "task"
  | "deal"
  | "invoice";

// Icon mapping for activity types
const activityIconMap: Record<
  ActivityRowType,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  call: PhoneIcon,
  meeting: VideoIcon,
  task: CheckCircleIcon,
  email: EnvelopeIcon,
  note: NoteIcon,
  deal: CurrencyDollarIcon,
  invoice: FileTextIcon,
};

interface ActivityRowProps {
  id: string;
  type: ActivityRowType;
  title: string;
  description: string;
  badge?: {
    label: string;
    variant:
      | "green"
      | "amber"
      | "red"
      | "blue"
      | "neutral"
      | "violet"
      | "emerald";
  };
  meta?: string;
  showBorder?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  customActions?: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    variant?: "danger";
  }[];
  className?: string;
}

export function ActivityRow({
  id,
  type,
  title,
  description,
  badge,
  meta,
  showBorder = true,
  onView,
  onEdit,
  onDelete,
  customActions,
  className,
}: ActivityRowProps) {
  const Icon = activityIconMap[type] || NoteIcon;

  // Build action menu items
  const actionItems = customActions || [
    ...(onView
      ? [
          {
            label: "View Details",
            icon: <EyeIcon size={16} />,
            onClick: onView,
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            label: "Edit",
            icon: <PencilSimpleIcon size={16} />,
            onClick: onEdit,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "Delete",
            icon: <TrashIcon size={16} />,
            variant: "danger" as const,
            onClick: onDelete,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        "flex items-start gap-4 py-4 px-5 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group",
        showBorder &&
          "border-b border-neutral-100 dark:border-neutral-800 last:border-b-0",
        className,
      )}
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-neutral-500 dark:text-neutral-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {title}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
          {description}
        </p>
        {(badge || meta) && (
          <div className="flex items-center gap-2 mt-1.5">
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            {meta && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                · {meta}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {actionItems.length > 0 && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionMenu items={actionItems} />
        </div>
      )}
    </div>
  );
}
