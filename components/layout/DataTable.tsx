"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "../ui/Icons";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onEdit,
  onDelete,
  onRowClick,
  selectable,
  selectedKeys = new Set(),
  onSelectionChange,
  pagination,
  loading,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === data.length) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(data.map(keyExtractor)));
    }
  };

  const handleSelectRow = (key: string | number) => {
    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    onSelectionChange?.(newSelection);
  };

  const hasActions = onEdit || onDelete;

  if (loading) {
    return (
      <div className={cn("border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden", className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                {selectable && <th className="w-12" />}
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left">
                    <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                  </th>
                ))}
                {hasActions && <th className="w-12" />}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-neutral-200 dark:border-neutral-800">
                  {selectable && <td className="px-4 py-4" />}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                    </td>
                  ))}
                  {hasActions && <td className="px-4 py-4" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("border border-neutral-200 dark:border-neutral-800 rounded-lg", className)}>
        {emptyState || (
          <EmptyState
            title="No data"
            description="No records found"
          />
        )}
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={className}>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                {selectable && (
                  <th className="w-12 px-4">
                    <input
                      type="checkbox"
                      checked={selectedKeys.size === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-neutral-300 dark:border-neutral-700"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider",
                      col.sortable && "cursor-pointer select-none hover:text-neutral-900 dark:hover:text-neutral-100",
                      col.className
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDirection === "asc" ? (
                          <ArrowUpIcon size={14} />
                        ) : (
                          <ArrowDownIcon size={14} />
                        )
                      )}
                    </div>
                  </th>
                ))}
                {hasActions && (
                  <th className="w-12 px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-950 divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.map((item) => {
                const key = keyExtractor(item);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => handleSelectRow(key)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-neutral-300 dark:border-neutral-700"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-4 py-4 text-sm text-neutral-900 dark:text-neutral-100", col.className)}
                      >
                        {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {onEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(item);
                              }}
                              className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                              aria-label="Edit"
                            >
                              <PencilSimpleIcon size={16} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item);
                              }}
                              className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <TrashIcon size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CaretLeftIcon size={16} />
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400 min-w-[80px] text-center">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CaretRightIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
