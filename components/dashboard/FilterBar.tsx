"use client";

import { useState } from "react";
import { FunnelIcon, MagnifyingGlassIcon, XIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    key: string;
    label: string;
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

  const clearFilter = (key: string) => {
    const filter = filters.find((f) => f.key === key);
    const defaultValue =
      filter?.defaultValue || filter?.options[0]?.value || "";
    setFilterValues((prev) => ({ ...prev, [key]: defaultValue }));
    onFilterChange?.(key, defaultValue);
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

  // Get active filters (not default/all values)
  const activeFilters = filters.filter((filter) => {
    const currentValue = filterValues[filter.key];
    const defaultValue = filter.defaultValue || filter.options[0]?.value || "";
    return currentValue !== defaultValue;
  });

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
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <Input
            leftIcon={<MagnifyingGlassIcon size={18} />}
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full sm:w-60"
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

        {/* Active Filter Tags */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => {
              const selectedOption = filter.options.find(
                (opt) => opt.value === filterValues[filter.key],
              );
              return (
                <button
                  key={filter.key}
                  onClick={() => clearFilter(filter.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-950 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <span>
                    {filter.label}: {selectedOption?.label.toLowerCase()}
                  </span>
                  <XIcon
                    size={14}
                    className="text-neutral-500 dark:text-neutral-400"
                  />
                </button>
              );
            })}
          </div>
        )}
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
  { label: "Free", value: "free" },
];

export const customerScoreOptions = [
  { label: "All Scores", value: "all" },
  { label: "High (80-100)", value: "90" },
  { label: "Medium (50-79)", value: "70" },
  { label: "Low (0-49)", value: "50" },
];

export const timeRangeOptions = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "This Year", value: "this_year" },
];
