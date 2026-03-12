"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Button,
  Badge,
  Input,
  Select,
  PlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  NoteIcon,
  EnvelopeIcon,
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import {
  LogActivityModal,
  ActivityDetailDrawer,
  CompleteMeetingModal,
} from "@/components/features";
import { cn } from "@/lib/utils";
import {
  createActivity,
  updateActivity,
  updateActivityStatus,
  deleteActivity,
} from "@/lib/actions/activities";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType = "call" | "meeting" | "task" | "email" | "note";
type ActivityStatus = "completed" | "scheduled" | "pending" | "cancelled";

export interface ActivityRecord {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  date: string | null;
  time?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  related_name?: string | null;
  created_at: string;
  [key: string]: unknown;
}

// ── Config ────────────────────────────────────────────────────────────────────

const statusConfig: Record<
  ActivityStatus,
  { label: string; variant: "green" | "amber" | "red" | "neutral" }
> = {
  completed: { label: "Completed", variant: "green" },
  scheduled: { label: "Scheduled", variant: "green" },
  pending: { label: "Pending", variant: "amber" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const typeLabels: Record<ActivityType, string> = {
  call: "Call",
  meeting: "Meeting",
  task: "Task",
  email: "Email",
  note: "Note",
};

const typeIcons: Record<
  ActivityType,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  call: PhoneIcon,
  meeting: CalendarBlankIcon,
  task: CheckCircleIcon,
  email: EnvelopeIcon,
  note: NoteIcon,
};

const typeColors: Record<ActivityType, string> = {
  call: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  meeting:
    "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400",
  task: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
  email:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  note: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapActivity(a: ActivityRecord) {
  return {
    id: a.id,
    type: (a.type || "task") as ActivityType,
    title: a.title || "",
    description: a.description || "",
    status: (a.status || "pending") as ActivityStatus,
    date: a.date || a.created_at,
    time: a.time,
    relatedTo: a.related_type
      ? {
          type: a.related_type as "deal" | "customer" | "lead",
          name: a.related_name || "",
          id: a.related_id || "",
        }
      : null,
  };
}

type MappedActivity = ReturnType<typeof mapActivity>;

function formatActivityDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const actDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays >= -7) return `In ${Math.abs(diffDays)} days`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ActivityPageClient({
  initialActivities,
  initialCount,
}: {
  initialActivities: ActivityRecord[];
  initialCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Modal/drawer state
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showCompleteMeeting, setShowCompleteMeeting] = useState(false);
  const [selectedActivity, setSelectedActivity] =
    useState<MappedActivity | null>(null);
  const [editActivity, setEditActivity] = useState<MappedActivity | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Map and filter activities
  const allActivities = useMemo(
    () => initialActivities.map(mapActivity),
    [initialActivities],
  );

  const filteredActivities = useMemo(() => {
    return allActivities.filter((a) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q) &&
          !(a.relatedTo?.name || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [allActivities, search, typeFilter, statusFilter]);

  // Compute stats from data
  const stats = useMemo(() => {
    const total = allActivities.length;
    const calls = allActivities.filter((a) => a.type === "call").length;
    const meetings = allActivities.filter((a) => a.type === "meeting").length;
    const scheduledMeetings = allActivities.filter(
      (a) => a.type === "meeting" && a.status === "scheduled",
    ).length;
    return {
      total,
      calls,
      meetings,
      scheduledMeetings,
    };
  }, [allActivities]);

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / rowsPerPage);
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  // Reset page when filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogActivity = async (data: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await createActivity({
        type: data.type,
        title: data.title,
        description: data.notes || "",
        status: "scheduled",
        date: data.date,
        time: data.time,
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setShowLogActivity(false);
        router.refresh();
      }
    });
  };

  const handleEditActivity = async (data: Record<string, unknown>) => {
    if (!editActivity) return;
    startTransition(async () => {
      const result = await updateActivity(editActivity.id, {
        type: data.type,
        title: data.title,
        description: data.notes || "",
        date: data.date,
        time: data.time,
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setEditActivity(null);
        router.refresh();
      }
    });
  };

  const handleMarkComplete = (id: string) => {
    startTransition(async () => {
      await updateActivityStatus(id, "completed");
      setShowDetail(false);
      setShowCompleteMeeting(false);
      router.refresh();
    });
  };

  const handleDeleteActivity = (id: string) => {
    startTransition(async () => {
      await deleteActivity(id);
      setActionMenuId(null);
      router.refresh();
    });
  };

  const openDetail = (activity: MappedActivity) => {
    setSelectedActivity(activity);
    setShowDetail(true);
  };

  const openEdit = (activity: MappedActivity) => {
    setEditActivity(activity);
    setActionMenuId(null);
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 flex flex-col gap-6 min-h-full">
      {/* Header */}
      <PageHeader title="Activities">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => setShowLogActivity(true)}
        >
          Log Activity
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Total Activities
          </p>
          <p className="mt-1 text-2xl font-serif font-medium text-neutral-950 dark:text-neutral-50">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Calls
          </p>
          <p className="mt-1 text-2xl font-serif font-medium text-neutral-950 dark:text-neutral-50">
            {stats.calls}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Meetings
          </p>
          <p className="mt-1 text-2xl font-serif font-medium text-neutral-950 dark:text-neutral-50">
            {stats.meetings}
          </p>
          {stats.scheduledMeetings > 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {stats.scheduledMeetings} upcoming
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search activities..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<MagnifyingGlassIcon size={18} />}
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          options={[
            { label: "All Types", value: "all" },
            { label: "Call", value: "call" },
            { label: "Meeting", value: "meeting" },
            { label: "Task", value: "task" },
            { label: "Email", value: "email" },
            { label: "Note", value: "note" },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          options={[
            { label: "All Statuses", value: "all" },
            { label: "Completed", value: "completed" },
            { label: "Scheduled", value: "scheduled" },
            { label: "Pending", value: "pending" },
            { label: "Cancelled", value: "cancelled" },
          ]}
        />
      </div>

      {/* Activity List */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden flex-1">
        {paginatedActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              No activities found
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowLogActivity(true)}
            >
              Log your first activity
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {paginatedActivities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                onClick={() => openDetail(activity)}
                onEdit={() => openEdit(activity)}
                onDelete={() => handleDeleteActivity(activity.id)}
                onMarkComplete={() => handleMarkComplete(activity.id)}
                actionMenuOpen={actionMenuId === activity.id}
                onToggleMenu={() =>
                  setActionMenuId(
                    actionMenuId === activity.id ? null : activity.id,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Showing {(currentPage - 1) * rowsPerPage + 1}–
            {Math.min(currentPage * rowsPerPage, filteredActivities.length)} of{" "}
            {filteredActivities.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <CaretLeftIcon size={16} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors",
                  page === currentPage
                    ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                )}
              >
                {page}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
            >
              <CaretRightIcon size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      <LogActivityModal
        key={showLogActivity ? "create" : "closed"}
        open={showLogActivity}
        onClose={() => setShowLogActivity(false)}
        mode="create"
        variant="activity"
        onSubmit={handleLogActivity}
      />

      {/* Edit Activity Modal */}
      {editActivity && (
        <LogActivityModal
          key={`edit-${editActivity.id}`}
          open={!!editActivity}
          onClose={() => setEditActivity(null)}
          mode="edit"
          variant="activity"
          initialData={{
            type: editActivity.type as "call" | "meeting" | "task" | "email" | "note",
            title: editActivity.title,
            relatedTo: editActivity.relatedTo
              ? {
                  id: editActivity.relatedTo.id,
                  name: editActivity.relatedTo.name,
                  type: editActivity.relatedTo.type as
                    | "customer"
                    | "lead"
                    | "deal",
                }
              : null,
            date: editActivity.date
              ? new Date(editActivity.date).toISOString().split("T")[0]
              : "",
            time: editActivity.time || "",
            duration: "30",
            notes: editActivity.description,
          }}
          onSubmit={handleEditActivity}
        />
      )}

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={showDetail}
        onClose={() => setShowDetail(false)}
        activity={
          selectedActivity
            ? {
                id: selectedActivity.id,
                type: selectedActivity.type,
                title: selectedActivity.title,
                description: selectedActivity.description,
                badge: statusConfig[selectedActivity.status]
                  ? {
                      label: statusConfig[selectedActivity.status].label,
                      variant: statusConfig[selectedActivity.status].variant,
                    }
                  : undefined,
                meta: selectedActivity.time
                  ? `${formatActivityDate(selectedActivity.date)} at ${selectedActivity.time}`
                  : formatActivityDate(selectedActivity.date),
              }
            : null
        }
        customerName={selectedActivity?.relatedTo?.name || ""}
        onMarkComplete={() => {
          if (
            selectedActivity?.type === "meeting" &&
            selectedActivity.status !== "completed"
          ) {
            setShowDetail(false);
            setShowCompleteMeeting(true);
          } else if (selectedActivity) {
            handleMarkComplete(selectedActivity.id);
          }
        }}
      />

      {/* Complete Meeting Modal */}
      <CompleteMeetingModal
        open={showCompleteMeeting}
        onClose={() => setShowCompleteMeeting(false)}
        onComplete={() => {
          if (selectedActivity) {
            handleMarkComplete(selectedActivity.id);
          }
        }}
      />
    </div>
  );
}

// ── ActivityRow ────────────────────────────────────────────────────────────────

function ActivityRow({
  activity,
  onClick,
  onEdit,
  onDelete,
  onMarkComplete,
  actionMenuOpen,
  onToggleMenu,
}: {
  activity: MappedActivity;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkComplete: () => void;
  actionMenuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const Icon = typeIcons[activity.type] || CheckCircleIcon;
  const colorClass = typeColors[activity.type] || typeColors.task;
  const status = statusConfig[activity.status];

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Type Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded",
          colorClass,
        )}
      >
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
            {activity.title}
          </p>
          {status && (
            <Badge variant={status.variant}>
              {status.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {typeLabels[activity.type] || activity.type}
          </span>
          {activity.relatedTo && (
            <>
              <span className="text-neutral-300 dark:text-neutral-600">
                &middot;
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {activity.relatedTo.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="hidden sm:block text-right shrink-0">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {formatActivityDate(activity.date)}
        </p>
        {activity.time && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {activity.time}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className="flex h-8 w-8 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          <DotsThreeIcon size={20} weight="bold" />
        </button>

        {actionMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-40 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onEdit}
              className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 first:rounded-t-lg"
            >
              Edit
            </button>
            {activity.status !== "completed" && (
              <button
                onClick={onMarkComplete}
                className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Mark Complete
              </button>
            )}
            <button
              onClick={onDelete}
              className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 last:rounded-b-lg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
