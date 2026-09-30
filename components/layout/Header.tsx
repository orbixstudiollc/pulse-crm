"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { CalendarDropdown, NotificationsDropdown } from "../features";
import { useHeader } from "./HeaderContext";
import { CaretLeftIcon, CaretRightIcon, ListIcon } from "../ui";
import { useSidebar } from "./SidebarContext";
import { HeaderUserMenu } from "./HeaderUserMenu";

export function Header() {
  const pathname = usePathname();
  const { config } = useHeader();
  const { openMobile } = useSidebar();
  const segments = pathname.split("/").filter(Boolean);
  // The leading "dashboard" segment is implied by the app shell.
  const crumbs = segments.slice(1);
  // Breadcrumb and back button only below a section root, and in Settings.
  const showTrail =
    segments.length > 2 || pathname.startsWith("/dashboard/settings");

  // Check if any page has set custom actions
  const hasCustomActions = !!config.actions;

  return (
    <header className="h-11 flex shrink-0 items-center border-b border-divider bg-surface">
      {/* Left: Mobile menu + wordmark */}
      <div className="flex w-[240px] shrink-0 items-center gap-2 px-6 max-lg:w-auto max-lg:px-4">
        {/* Mobile hamburger */}
        <button
          onClick={openMobile}
          className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          aria-label="Open menu"
        >
          <ListIcon size={16} />
        </button>

        <Link
          href="/dashboard/overview"
          className="text-[18px] font-semibold text-fg"
        >
          Pulse
        </Link>
      </div>

      {/* Back button + Breadcrumb */}
      {showTrail && (
        <div className="flex min-w-0 items-center gap-2 lg:pl-8">
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
            {crumbs.map((segment, index) => {
              // Replace ID-like segments (numeric or long hashes) with breadcrumbLabel
              const isIdSegment =
                /^[0-9]+$/.test(segment) ||
                segment.length > 20 ||
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
              // Friendly names for hyphenated route segments
              const segmentLabels: Record<string, string> = {
                "lead-finder": "Lead Finder",
                icp: "ICP",
                "website-visitors": "Website visitors",
              };
              // Never show a raw ID: use the page's label, or a muted placeholder until it is set
              const displayText = isIdSegment ? (
                config.breadcrumbLabel ?? (
                  <span aria-hidden="true" className="text-fg-muted">
                    …
                  </span>
                )
              ) : (
                segmentLabels[segment] ??
                decodeURIComponent(segment).replace(/^./, (c) => c.toUpperCase())
              );

              return (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && (
                    <CaretRightIcon size={12} className="text-fg-muted" />
                  )}
                  <span
                    className={
                      index === crumbs.length - 1
                        ? "text-fg"
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
      )}

      {/* Right: Custom actions or default toolbar */}
      <div className="ml-auto flex items-center gap-1 pr-4">
        {hasCustomActions ? (
          config.actions
        ) : (
          <>
            <SearchBar />
            <CalendarDropdown />
            <NotificationsDropdown />
          </>
        )}
        <HeaderUserMenu />
      </div>
    </header>
  );
}
