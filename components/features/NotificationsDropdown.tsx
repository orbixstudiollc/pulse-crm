"use client";

import { useState, useRef, useEffect } from "react";
import {
  BellIcon,
  IconButton,
  UsersIcon,
  CurrencyDollarIcon,
  CheckIcon,
  FunnelIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: React.ReactNode;
  type: "lead" | "deal" | "contact" | "system";
}

const notifications: Notification[] = [
  {
    id: "1",
    title: "New lead assigned",
    description: "Maria Santos was assigned to you",
    time: "2 min ago",
    read: false,
    icon: <FunnelIcon size={16} />,
    type: "lead",
  },
  {
    id: "2",
    title: "Deal closed",
    description: "Acme Corp - Enterprise marked as won",
    time: "1 hour ago",
    read: false,
    icon: <CurrencyDollarIcon size={16} />,
    type: "deal",
  },
  {
    id: "3",
    title: "New contact added",
    description: "James Wilson added to Acme Corp",
    time: "3 hours ago",
    read: true,
    icon: <UsersIcon size={16} />,
    type: "contact",
  },
  {
    id: "4",
    title: "Lead status updated",
    description: "Sarah Chen moved to Qualified",
    time: "5 hours ago",
    read: true,
    icon: <FunnelIcon size={16} />,
    type: "lead",
  },
  {
    id: "5",
    title: "Deal value updated",
    description: "TechStart Inc increased to $18,000",
    time: "Yesterday",
    read: true,
    icon: <CurrencyDollarIcon size={16} />,
    type: "deal",
  },
];

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  useClickOutside(dropdownRef, () => setOpen(false), open);

  const markAllAsRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        icon={
          <BellIcon size={16} className="text-fg-secondary" />
        }
        badge={unreadCount > 0 ? unreadCount : undefined}
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div className="absolute right-0 top-full mt-1 w-96 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50">
          {/* Header */}
          <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
            <h3 className="text-sm font-semibold text-fg">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-fg-secondary hover:text-fg transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface mb-3">
                  <BellIcon size={16} className="text-fg-muted" />
                </div>
                <p className="text-sm font-medium text-fg mb-1">
                  No notifications
                </p>
                <span className="text-sm text-fg-secondary">
                  You&apos;re all caught up!
                </span>
              </div>
            ) : (
              items.map((notification, index) => (
                <button
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                    !notification.read &&
                      "bg-subtle",
                    index < items.length - 1 &&
                      "border-b border-divider",
                  )}
                >
                  {/* Icon */}
                  <span className="flex h-8 w-8 items-center justify-center rounded-md shrink-0 bg-muted text-fg-secondary">
                    {notification.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm truncate",
                          notification.read
                            ? "text-fg-secondary"
                            : "font-medium text-fg",
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-accent-strong shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-fg-secondary truncate mt-0.5">
                      {notification.description}
                    </p>
                    <p className="text-xs text-fg-muted mt-1">
                      {notification.time}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-divider bg-subtle px-4 py-2.5">
            <button className="w-full text-center text-xs font-medium text-fg-secondary hover:text-fg transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
