"use client";

import { ReactNode } from "react";
import { Dropdown } from "@/components/ui";
import { cn } from "@/lib/utils";

const defaultRowsPerPageOptions = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

interface TableHeaderProps {
  title: string;
  rowsPerPage: string;
  onRowsPerPageChange: (value: string) => void;
  rowsPerPageOptions?: { label: string; value: string }[];
  actions?: ReactNode;
  className?: string;
}

export function TableHeader({
  title,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = defaultRowsPerPageOptions,
  actions,
  className,
}: TableHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800",
        className,
      )}
    >
      <h3 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
        {title}
      </h3>
      <div className="flex items-center gap-4">
        {actions}
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Show
          </span>
          <Dropdown
            options={rowsPerPageOptions}
            value={rowsPerPage}
            onChange={onRowsPerPageChange}
            icon={null}
            size="md"
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            rows
          </span>
        </div>
      </div>
    </div>
  );
}
