"use client";

import { useState, useRef } from "react";
import { BellIcon, IconButton } from "@/components/ui";
import { useClickOutside } from "@/hooks";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setOpen(false), open);

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        icon={
          <BellIcon size={16} className="text-fg-secondary" />
        }
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div className="absolute right-0 top-full mt-1 w-96 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50">
          {/* Header */}
          <div className="flex h-12 items-center px-4 border-b border-divider">
            <h3 className="text-sm font-semibold text-fg">
              Notifications
            </h3>
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface mb-3">
              <BellIcon size={16} className="text-fg-muted" />
            </div>
            <p className="text-sm font-medium text-fg mb-1">
              You&apos;re all caught up
            </p>
            <span className="text-sm text-fg-secondary">
              Notifications will appear here.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
