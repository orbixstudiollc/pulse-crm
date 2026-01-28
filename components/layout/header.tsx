"use client";

import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header
      className="flex h-16 items-center justify-between border-b px-8"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        {segments.map((segment, index) => (
          <span key={segment} className="flex items-center gap-2">
            {index > 0 && <span className="text-muted">/</span>}
            <span
              className={
                index === segments.length - 1
                  ? "font-medium text-primary uppercase"
                  : "text-muted uppercase"
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
        <div
          className="flex items-center gap-2 rounded-lg border px-4 py-2"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
          }}
        >
          <SearchIcon className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">Search...</span>
          <kbd className="ml-4 rounded bg-tertiary px-2 py-0.5 text-xs text-muted">
            ⌘K
          </kbd>
        </div>

        {/* Calendar */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-tertiary"
          style={{ borderColor: "var(--border-default)" }}
        >
          <CalendarIcon className="h-5 w-5 text-secondary" />
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-tertiary"
          style={{ borderColor: "var(--border-default)" }}
        >
          <BellIcon className="h-5 w-5 text-secondary" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-success-500" />
        </button>
      </div>
    </header>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
