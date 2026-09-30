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
    <header className="h-14 flex shrink-0 items-center justify-between border-b border-divider bg-surface px-6">
      {/* Left: Mobile menu + Back button + Breadcrumb */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={openMobile}
          className="hidden max-lg:flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          aria-label="Open menu"
        >
          <ListIcon size={16} />
        </button>

        {config.backHref && (
          <Link
            href={config.backHref}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          >
            <CaretLeftIcon size={16} />
          </Link>
        )}

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-[14px]">
          {segments.map((segment, index) => {
            // Replace ID-like segments (numeric or long hashes) with breadcrumbLabel
            const isIdSegment = /^[0-9]+$/.test(segment) || segment.length > 20;
            // Friendly names for hyphenated route segments
            const segmentLabels: Record<string, string> = {
              "lead-finder": "Lead Finder",
              icp: "ICP",
              "website-visitors": "Website visitors",
            };
            const displayText =
              isIdSegment && config.breadcrumbLabel
                ? config.breadcrumbLabel
                : segmentLabels[segment] ??
                  decodeURIComponent(segment).replace(/^./, (c) => c.toUpperCase());

            return (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && <span className="text-fg-muted">/</span>}
                <span
                  className={
                    index === segments.length - 1
                      ? "font-medium text-fg"
                      : "text-fg-secondary"
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
      <div className="flex items-center gap-1.5">
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
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          aria-label="Settings"
        >
          <GearIcon size={16} />
        </Link>
        <HeaderUserMenu />
      </div>
    </header>
  );
}
