"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { CalendarDropdown, NotificationsDropdown } from "../features";
import { useHeader } from "./HeaderContext";
import { CaretLeftIcon } from "../ui";

export function Header() {
  const pathname = usePathname();
  const { config } = useHeader();
  const segments = pathname.split("/").filter(Boolean);

  // Check if any page has set custom actions
  const hasCustomActions = !!config.actions;

  return (
    <header className="flex h-20 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-8">
      {/* Left: Back button + Breadcrumb */}
      <div className="flex items-center gap-3">
        {config.backHref && (
          <Link
            href={config.backHref}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          >
            <CaretLeftIcon
              size={16}
              className="text-neutral-600 dark:text-neutral-400"
            />
          </Link>
        )}

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
                {decodeURIComponent(segment)}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Right: Custom actions or default toolbar */}
      <div className="flex items-center gap-3">
        {hasCustomActions ? (
          config.actions
        ) : (
          <>
            <SearchBar />
            <CalendarDropdown />
            <NotificationsDropdown />
          </>
        )}
      </div>
    </header>
  );
}
