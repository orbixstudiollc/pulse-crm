"use client";

import { useState } from "react";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  Input,
  Dropdown,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    key: string;
    options: { label: string; value: string }[];
    defaultValue?: string;
  }[];
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = "Search...",
  onSearchChange,
  filters = [],
  onFilterChange,
  className,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    filters.reduce(
      (acc, filter) => {
        acc[filter.key] = filter.defaultValue || filter.options[0]?.value || "";
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearchChange?.(e.target.value);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    onFilterChange?.(key, value);
  };

  const handleClearAll = () => {
    setSearchValue("");
    onSearchChange?.("");
    const resetValues = filters.reduce(
      (acc, filter) => {
        acc[filter.key] = filter.defaultValue || filter.options[0]?.value || "";
        return acc;
      },
      {} as Record<string, string>,
    );
    setFilterValues(resetValues);
    filters.forEach((filter) => {
      onFilterChange?.(
        filter.key,
        filter.defaultValue || filter.options[0]?.value || "",
      );
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-950 dark:text-neutral-50">
          <FunnelIcon size={18} />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <button
          onClick={handleClearAll}
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-5">
        {/* Search */}
        <Input
          leftIcon={<MagnifyingGlassIcon size={18} />}
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
          className="w-56"
        />

        {/* Filter Dropdowns */}
        {filters.map((filter) => (
          <Dropdown
            key={filter.key}
            options={filter.options}
            value={filterValues[filter.key]}
            onChange={(value) => handleFilterChange(filter.key, value)}
            icon={null}
          />
        ))}
      </div>
    </div>
  );
}

// Pre-defined filter options for Customers
export const customerStatusOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Inactive", value: "inactive" },
];

export const customerPlanOptions = [
  { label: "All Plans", value: "all" },
  { label: "Enterprise", value: "enterprise" },
  { label: "Pro", value: "pro" },
  { label: "Starter", value: "starter" },
];

export const customerScoreOptions = [
  { label: "All Scores", value: "all" },
  { label: "90+", value: "90" },
  { label: "70-89", value: "70" },
  { label: "50-69", value: "50" },
  { label: "Below 50", value: "below50" },
];

export const timeRangeOptions = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "This Year", value: "this_year" },
];
