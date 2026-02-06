"use client";

import { useState } from "react";
import {
  Button,
  Badge,
  ActionMenu,
  Dropdown,
  PlusIcon,
  ExportIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  NoteIcon,
  ActivityIcon,
} from "@/components/ui";
import { PageHeader, FilterBar, StatCard } from "@/components/dashboard";
import {
  activities as allActivities,
  activityStats,
  statusConfig,
  type Activity,
  type ActivityType,
} from "@/lib/data/activities";
import { cn } from "@/lib/utils";

// Icon mapping for activity types
const activityIconMap: Record<
  ActivityType,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  call: PhoneIcon,
  meeting: CalendarBlankIcon,
  task: CheckCircleIcon,
  email: EnvelopeIcon,
  note: NoteIcon,
};

// Filter options
const activityStatusOptions = [
  { label: "All Status", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Pending", value: "pending" },
  { label: "Cancelled", value: "cancelled" },
];

const activityTypeOptions = [
  { label: "All Types", value: "all" },
  { label: "Calls", value: "call" },
  { label: "Meetings", value: "meeting" },
  { label: "Tasks", value: "task" },
  { label: "Emails", value: "email" },
  { label: "Notes", value: "note" },
];

const relatedToOptions = [
  { label: "Related To", value: "all" },
  { label: "Deals", value: "deal" },
  { label: "Customers", value: "customer" },
  { label: "Leads", value: "lead" },
];

const rowsPerPageOptions = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export default function ActivityPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("5");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [relatedToFilter, setRelatedToFilter] = useState("all");

  // Filter activities
  const filteredActivities = allActivities.filter((activity) => {
    const matchesSearch =
      searchValue === "" ||
      activity.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchValue.toLowerCase()) ||
      activity.relatedTo.name.toLowerCase().includes(searchValue.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || activity.status === statusFilter;

    const matchesType = typeFilter === "all" || activity.type === typeFilter;

    const matchesRelatedTo =
      relatedToFilter === "all" || activity.relatedTo.type === relatedToFilter;

    return matchesSearch && matchesStatus && matchesType && matchesRelatedTo;
  });

  // Pagination
  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(filteredActivities.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedActivities = filteredActivities.slice(
    startIndex,
    startIndex + perPage,
  );
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(startIndex + perPage, filteredActivities.length);

  const handleFilterChange = (key: string, value: string) => {
    switch (key) {
      case "status":
        setStatusFilter(value);
        break;
      case "type":
        setTypeFilter(value);
        break;
      case "relatedTo":
        setRelatedToFilter(value);
        break;
    }
    setCurrentPage(1);
  };

  // Pagination page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="py-6 px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Activities">
        <Button variant="outline" leftIcon={<ExportIcon size={18} />}>
          Export
        </Button>
        <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
          Log Activity
        </Button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Activities"
          value={activityStats.totalActivities}
          change={{ value: activityStats.totalChange, trend: "up" }}
          icon={
            <ActivityIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Calls This Week"
          value={activityStats.callsThisWeek}
          change={{ value: activityStats.callsChange, trend: "up" }}
          icon={
            <PhoneIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Meetings This Week"
          value={activityStats.meetingsThisWeek}
          change={{
            value: `${activityStats.meetingsUpcoming} upcoming`,
            trend: "neutral",
          }}
          icon={
            <CalendarBlankIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search activities..."
        onSearchChange={(value) => {
          setSearchValue(value);
          setCurrentPage(1);
        }}
        filters={[
          {
            key: "status",
            label: "Status",
            options: activityStatusOptions,
          },
          {
            key: "type",
            label: "Type",
            options: activityTypeOptions,
          },
          {
            key: "relatedTo",
            label: "Related To",
            options: relatedToOptions,
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {/* Activity List */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
            Recent Activity
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Show
            </span>
            <Dropdown
              options={rowsPerPageOptions}
              value={rowsPerPage}
              onChange={(value) => {
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              icon={null}
              size="md"
            />
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              rows
            </span>
          </div>
        </div>

        {/* Activity Rows */}
        <div>
          {paginatedActivities.length > 0 ? (
            paginatedActivities.map((activity, index) => {
              const Icon = activityIconMap[activity.type];
              const status = statusConfig[activity.status];

              return (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-start gap-4 py-4 px-5 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group",
                    index !== paginatedActivities.length - 1 &&
                      "border-b border-neutral-100 dark:border-neutral-800",
                  )}
                >
                  <div className="w-9 h-9 rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 flex items-center justify-center shrink-0">
                    <Icon
                      size={18}
                      className="text-neutral-500 dark:text-neutral-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                      {activity.title}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {activity.time && (
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          · {activity.date}, {activity.time}
                        </span>
                      )}
                      {!activity.time && (
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          · {activity.date}
                        </span>
                      )}
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        · {activity.relatedTo.name}
                      </span>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionMenu
                      items={[
                        {
                          label: "View Details",
                          icon: <EyeIcon size={16} />,
                          onClick: () => {},
                        },
                        {
                          label: "Edit",
                          icon: <PencilSimpleIcon size={16} />,
                          onClick: () => {},
                        },
                        {
                          label: "Delete",
                          icon: <TrashIcon size={16} />,
                          variant: "danger",
                          onClick: () => {},
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
              <p>No activities found</p>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredActivities.length > 0 && (
          <div className="flex items-center justify-between p-5 border-t border-neutral-200 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Showing{" "}
              <span className="font-medium text-neutral-950 dark:text-neutral-50">
                {displayStart}–{displayEnd}
              </span>{" "}
              of{" "}
              <span className="font-medium text-neutral-950 dark:text-neutral-50">
                {filteredActivities.length}
              </span>{" "}
              activities
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CaretLeftIcon size={16} />
              </button>
              {getPageNumbers().map((page, index) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-9 w-9 items-center justify-center text-neutral-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                      currentPage === page
                        ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                        : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    )}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CaretRightIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
