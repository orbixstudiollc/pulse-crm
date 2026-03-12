"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { CalendarDropdown, NotificationsDropdown } from "../features";
import { useHeader } from "./HeaderContext";
import { CaretLeftIcon, GearIcon, ListIcon } from "../ui";
import { useSidebar } from "./SidebarContext";
import { HeaderUserMenu } from "./HeaderUserMenu";

export function Header() {
  const pathname = usePathname();
  const { config } = useHeader();
  const { openMobile } = useSidebar();
  const segments = pathname.split("/").filter(Boolean);

  // Check if any page has set custom actions
  const hasCustomActions = !!config.actions;

  return (
    <header className="flex h-16 lg:h-20 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-8">
      {/* Left: Mobile menu + Back button + Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={openMobile}
          className="hidden max-lg:flex h-11 w-11 items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Open menu"
        >
          <ListIcon
            size={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
        </button>

        {config.backHref && (
          <Link
            href={config.backHref}
            className="flex h-11 w-11 items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          >
            <CaretLeftIcon
              size={16}
              className="text-neutral-600 dark:text-neutral-400"
            />
          </Link>
        )}

        <nav className="hidden sm:flex items-center gap-2 text-xs">
          {segments.map((segment, index) => {
            // Replace ID-like segments (numeric or long hashes) with breadcrumbLabel
            const isIdSegment = /^[0-9]+$/.test(segment) || segment.length > 20;
            const displayText =
              isIdSegment && config.breadcrumbLabel
                ? config.breadcrumbLabel
                : decodeURIComponent(segment);

            return (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && <span className="text-neutral-500">/</span>}
                <span
                  className={
                    index === segments.length - 1
                      ? "font-medium text-neutral-950 dark:text-neutral-50 uppercase"
                      : "text-neutral-500 uppercase"
                  }
                >
                  {displayText}
                </span>
              </span>
            );
          })}
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
        <Link
          href="/dashboard/settings"
          className="flex h-11 w-11 items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Settings"
        >
          <GearIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
        </Link>
        <HeaderUserMenu />
      </div>
    </header>
  );
}
