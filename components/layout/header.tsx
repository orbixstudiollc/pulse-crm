"use client";

import { usePathname } from "next/navigation";
import { CalendarBlankIcon, IconButton } from "../ui";
import { SearchBar } from "./SearchBar";
import { NotificationsDropdown } from "../features";

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
        <SearchBar />

        <IconButton
          icon={
            <CalendarBlankIcon
              size={20}
              className="text-neutral-600 dark:text-neutral-400"
            />
          }
          aria-label="Calendar"
        />

        <NotificationsDropdown />
      </div>
    </header>
  );
}
