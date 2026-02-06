"use client";

import { useState } from "react";
import {
  Button,
  PlusIcon,
  ExportIcon,
  PhoneIcon,
  CalendarBlankIcon,
  ActivityIcon,
} from "@/components/ui";
import {
  PageHeader,
  FilterBar,
  StatCard,
  ActivityRow,
  TableHeader,
  TableFooter,
} from "@/components/dashboard";
import {
  activities as allActivities,
  activityStats,
  statusConfig,
  type ActivityType,
} from "@/lib/data/activities";

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
        <TableHeader
          title="Recent Activity"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        />

        {/* Activity Rows */}
        <div>
          {paginatedActivities.length > 0 ? (
            paginatedActivities.map((activity) => {
              const status = statusConfig[activity.status];
              const meta = activity.time
                ? `${activity.date}, ${activity.time} · ${activity.relatedTo.name}`
                : `${activity.date} · ${activity.relatedTo.name}`;

              return (
                <ActivityRow
                  key={activity.id}
                  id={activity.id}
                  type={activity.type as ActivityType}
                  title={activity.title}
                  description={activity.description}
                  badge={{ label: status.label, variant: status.variant }}
                  meta={meta}
                  onView={() => console.log("View:", activity.id)}
                  onEdit={() => console.log("Edit:", activity.id)}
                  onDelete={() => console.log("Delete:", activity.id)}
                />
              );
            })
          ) : (
            <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
              <p>No activities found</p>
            </div>
          )}
        </div>

        {/* Table Footer with Pagination */}
        <TableFooter
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredActivities.length}
          startIndex={displayStart}
          endIndex={displayEnd}
          onPageChange={setCurrentPage}
          itemLabel="activities"
        />
      </div>
    </div>
  );
}
