"use client";

import { Pagination } from "./Pagination";
import { cn } from "@/lib/utils";

interface TableFooterProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

export function TableFooter({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  itemLabel = "items",
  className,
}: TableFooterProps) {
  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-5 border-t border-neutral-200 dark:border-neutral-800",
        className,
      )}
    >
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Showing{" "}
        <span className="font-medium text-neutral-950 dark:text-neutral-50">
          {startIndex}–{endIndex}
        </span>{" "}
        of{" "}
        <span className="font-medium text-neutral-950 dark:text-neutral-50">
          {totalItems}
        </span>{" "}
        {itemLabel}
      </p>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
