"use client";

import { useState, useTransition, useMemo, useSyncExternalStore } from "react";
import {
  Button,
  Badge,
  Input,
  Select,
  PlusIcon,
  PulseIcon,
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
import { Page, PageHeader, MetricStrip, Metric } from "@/components/dashboard";
import {
  LogActivityModal,
  ActivityDetailDrawer,
  CompleteMeetingModal,
} from "@/components/features";
import { cn } from "@/lib/utils";
import { parseLocalDate, relativeDayLabel } from "@/lib/utils/local-date";
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
  { label: string; variant: "success" | "warning" | "error" | "neutral" }
> = {
  completed: { label: "Completed", variant: "success" },
  scheduled: { label: "Scheduled", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
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
  call: "bg-accent-surface text-accent-on-surface",
  meeting:
    "bg-accent-surface text-accent-on-surface",
  task: "bg-success-surface text-success",
  email:
    "bg-warning-surface text-warning",
  note: "bg-muted text-fg-secondary",
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

const subscribeNoop = () => () => {};

// The relative label depends on today's date in the browser's time zone, which
// the UTC server render cannot know, so it replaces the absolute date after mount.
function formatActivityDate(value: string, today: Date | null): string {
  const date = parseLocalDate(value);
  if (!date) return value;
  if (today) return relativeDayLabel(date, today);
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
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const today = isMounted ? new Date() : null;

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
    <Page>
      {/* Header */}
      <PageHeader title="Activities" icon={<PulseIcon size={18} />}>
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => setShowLogActivity(true)}
        >
          Log Activity
        </Button>
      </PageHeader>

      {/* Stats */}
      <MetricStrip>
        <Metric label="Total Activities" value={stats.total} />
        <Metric label="Calls" value={stats.calls} />
        <Metric
          label="Meetings"
          value={stats.meetings}
          hint={
            stats.scheduledMeetings > 0
              ? `${stats.scheduledMeetings} upcoming`
              : undefined
          }
        />
      </MetricStrip>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-8 max-sm:px-4 py-2 border-t border-divider">
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
        >
          {[
            { label: "All Types", value: "all" },
            { label: "Call", value: "call" },
            { label: "Meeting", value: "meeting" },
            { label: "Task", value: "task" },
            { label: "Email", value: "email" },
            { label: "Note", value: "note" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          {[
            { label: "All Statuses", value: "all" },
            { label: "Completed", value: "completed" },
            { label: "Scheduled", value: "scheduled" },
            { label: "Pending", value: "pending" },
            { label: "Cancelled", value: "cancelled" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Activity List */}
      <div className="border-t border-divider">
        {paginatedActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-fg-secondary text-sm">
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
          <div>
            {paginatedActivities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                today={today}
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
        <div className="flex h-12 items-center justify-between gap-4 px-8 max-sm:px-4 text-[13px] text-fg-muted">
          <p>
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
                  "flex h-8 w-8 items-center justify-center rounded-md border text-[13px] font-medium transition-colors",
                  page === currentPage
                    ? "border-accent text-accent-strong bg-surface"
                    : "border-line text-fg-secondary hover:bg-subtle",
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
                date: selectedActivity.date,
                time: selectedActivity.time,
                badge: statusConfig[selectedActivity.status]
                  ? {
                      label: statusConfig[selectedActivity.status].label,
                      variant: statusConfig[selectedActivity.status].variant,
                    }
                  : undefined,
                meta: selectedActivity.time
                  ? `${formatActivityDate(selectedActivity.date, today)} at ${selectedActivity.time}`
                  : formatActivityDate(selectedActivity.date, today),
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
    </Page>
  );
}

// ── ActivityRow ────────────────────────────────────────────────────────────────

function ActivityRow({
  activity,
  today,
  onClick,
  onEdit,
  onDelete,
  onMarkComplete,
  actionMenuOpen,
  onToggleMenu,
}: {
  activity: MappedActivity;
  today: Date | null;
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
      className="flex items-center gap-4 border-b border-divider px-8 py-3 hover:bg-subtle transition-colors cursor-pointer max-sm:px-4"
      onClick={onClick}
    >
      {/* Type Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          colorClass,
        )}
      >
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-fg truncate">
            {activity.title}
          </p>
          {status && (
            <Badge variant={status.variant}>
              {status.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-fg-secondary">
            {typeLabels[activity.type] || activity.type}
          </span>
          {activity.relatedTo && (
            <>
              <span className="text-fg-disabled">
                &middot;
              </span>
              <span className="text-xs text-fg-secondary truncate">
                {activity.relatedTo.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="hidden sm:block text-right shrink-0">
        <p className="text-sm text-fg-secondary">
          {formatActivityDate(activity.date, today)}
        </p>
        {activity.time && (
          <p className="text-xs text-fg-muted">
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
          className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-fg-secondary hover:bg-subtle transition-colors"
        >
          <DotsThreeIcon size={16} weight="bold" />
        </button>

        {actionMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-40 rounded-md border border-line bg-surface shadow-dropdown z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onEdit}
              className="w-full px-4 py-2.5 text-left text-sm text-fg hover:bg-muted first:rounded-t-lg"
            >
              Edit
            </button>
            {activity.status !== "completed" && (
              <button
                onClick={onMarkComplete}
                className="w-full px-4 py-2.5 text-left text-sm text-fg hover:bg-muted"
              >
                Mark Complete
              </button>
            )}
            <button
              onClick={onDelete}
              className="w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-surface last:rounded-b-lg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
