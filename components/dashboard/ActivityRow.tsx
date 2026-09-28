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
  type BadgeVariant,
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
    variant: BadgeVariant;
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
        "flex items-start gap-3 py-3 px-4 hover:bg-subtle transition-colors group",
        showBorder &&
          "border-b border-row last:border-b-0",
        className,
      )}
    >
      {/* Icon */}
      <div className="w-7 h-7 rounded-md border border-line bg-subtle flex items-center justify-center shrink-0">
        <Icon size={14} className="text-fg-secondary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-fg">
          {title}
        </p>
        <p className="text-[13px] text-fg-secondary line-clamp-1">
          {description}
        </p>
        {(badge || meta) && (
          <div className="flex items-center gap-2 mt-1">
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            {meta && (
              <span className="text-xs text-fg-secondary">
                · {meta}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {actionItems.length > 0 && (
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <ActionMenu items={actionItems} />
        </div>
      )}
    </div>
  );
}
