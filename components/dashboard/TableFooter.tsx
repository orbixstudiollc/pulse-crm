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
        "flex h-12 items-center justify-between gap-4 px-8 max-sm:px-4 text-[13px] text-fg-muted",
        className,
      )}
    >
      <p>
        Showing{" "}
        <span className="font-medium text-fg">
          {startIndex}–{endIndex}
        </span>{" "}
        of{" "}
        <span className="font-medium text-fg">
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
