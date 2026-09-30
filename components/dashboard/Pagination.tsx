"use client";

import { CaretLeftIcon, CaretRightIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  // Generate page numbers with ellipsis
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

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-fg-secondary hover:bg-subtle hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CaretLeftIcon size={14} />
      </button>

      {getPageNumbers().map((page, index) =>
        page === "..." ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-7 w-7 items-center justify-center text-[13px] text-fg-muted"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              currentPage === page
                ? "border border-accent text-accent-strong"
                : "text-fg-secondary hover:bg-subtle",
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-fg-secondary hover:bg-subtle hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CaretRightIcon size={14} />
      </button>
    </div>
  );
}
