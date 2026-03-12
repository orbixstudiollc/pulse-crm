"use client";

import { useState, useRef } from "react";
import { CalendarBlankIcon, CaretDownIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  icon = <CalendarBlankIcon size={20} />,
  size = "md",
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setOpen(false), open);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(!open)}
        leftIcon={icon || undefined}
        rightIcon={
          <CaretDownIcon
            size={16}
            className={cn(
              "transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        }
        className={className}
      >
        {selectedOption?.label}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-40 rounded-[12px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-dropdown overflow-hidden z-50 p-2">
          <div className="space-y-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center px-4 py-2.5 text-sm text-left transition-colors rounded",
                  option.value === value
                    ? "bg-neutral-100 dark:bg-neutral-800 font-medium text-neutral-950 dark:text-neutral-50"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Pre-defined date range options
export const dateRangeOptions: DropdownOption[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "This Year", value: "this_year" },
];

export const yearOptions: DropdownOption[] = [
  { label: "This Year", value: "this_year" },
  { label: "Last Year", value: "last_year" },
];
