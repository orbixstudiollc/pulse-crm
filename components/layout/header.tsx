"use client";

import { usePathname } from "next/navigation";
import { BellIcon, CalendarBlankIcon, MagnifyingGlassIcon } from "../ui";

export function Header() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-20 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs">
        {segments.map((segment, index) => (
          <span key={segment} className="flex items-center gap-2">
            {index > 0 && <span className="text-neutral-500">/</span>}
            <span
              className={
                index === segments.length - 1
                  ? "font-medium text-neutral-950 dark:text-neutral-50 uppercase"
                  : "text-neutral-500 uppercase"
              }
            >
              {segment}
            </span>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-2">
          <MagnifyingGlassIcon size={16} className="text-neutral-500" />
          <span className="text-sm text-neutral-500">Search...</span>
          <kbd className="ml-4 rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">
            ⌘K
          </kbd>
        </div>

        {/* Calendar */}
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <CalendarBlankIcon
            size={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
        </button>

        {/* Notifications */}
        <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <BellIcon
            size={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-500" />
        </button>
      </div>
    </header>
  );
}
