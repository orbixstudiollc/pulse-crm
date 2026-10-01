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
        "flex flex-wrap items-center gap-2 py-2",
        className,
      )}
    >
      {/* Label */}
      <div className="flex items-center gap-1.5 text-fg-secondary">
        <FunnelIcon size={16} />
        <span className="text-[13px] font-medium">Filters</span>
      </div>

      {/* Search */}
      <Input
        leftIcon={<MagnifyingGlassIcon size={16} />}
        value={searchValue}
        onChange={handleSearchChange}
        placeholder={searchPlaceholder}
        className="h-8 w-full sm:w-60"
      />

      {/* Filter Dropdowns */}
      {filters.map((filter) => (
        <Dropdown
          key={filter.key}
          options={filter.options}
          value={filterValues[filter.key]}
          onChange={(value) => handleFilterChange(filter.key, value)}
          icon={null}
          size="sm"
        />
      ))}

      {/* Active Filter Tags */}
      {activeFilters.map((filter) => {
        const selectedOption = filter.options.find(
          (opt) => opt.value === filterValues[filter.key],
        );
        return (
          <button
            key={filter.key}
            onClick={() => clearFilter(filter.key)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-subtle px-2.5 text-[13px] text-fg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>
              {filter.label}: {selectedOption?.label.toLowerCase()}
            </span>
            <XIcon
              size={12}
              className="text-fg-secondary"
            />
          </button>
        );
      })}

      <button
        onClick={handleClearAll}
        className="ml-auto inline-flex min-h-8 items-center px-2 text-[13px] text-fg-secondary hover:text-fg transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Clear all
      </button>
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
