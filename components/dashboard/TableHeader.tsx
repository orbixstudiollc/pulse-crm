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
        "flex h-12 items-center justify-between px-4 border-b border-divider",
        className,
      )}
    >
      <h3 className="text-[16px] leading-6 font-semibold text-fg">
        {title}
      </h3>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-fg-secondary">
            Show
          </span>
          <Dropdown
            options={rowsPerPageOptions}
            value={rowsPerPage}
            onChange={onRowsPerPageChange}
            icon={null}
            size="md"
          />
          <span className="text-[13px] text-fg-secondary">
            rows
          </span>
        </div>
      </div>
    </div>
  );
}
