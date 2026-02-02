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
          <BellIcon
            size={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
        }
        badge={unreadCount > 0 ? unreadCount : undefined}
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mb-3">
                  <BellIcon
                    size={20}
                    className="text-neutral-400 dark:text-neutral-500"
                  />
                </div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1">
                  No notifications
                </p>
                <span className="text-sm text-neutral-500">
                  You&apos;re all caught up!
                </span>
              </div>
            ) : (
              items.map((notification, index) => (
                <button
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                    !notification.read &&
                      "bg-neutral-50/50 dark:bg-neutral-800/30",
                    index < items.length - 1 &&
                      "border-b-[0.5px] border-neutral-100 dark:border-neutral-800",
                  )}
                >
                  {/* Icon */}
                  <span className="flex h-10 w-10 items-center justify-center rounded-full shrink-0 mt-0.5 border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 text-neutral-950 dark:text-neutral-50">
                    {notification.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm truncate",
                          notification.read
                            ? "text-neutral-600 dark:text-neutral-400"
                            : "font-medium text-neutral-950 dark:text-neutral-50",
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {notification.description}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                      {notification.time}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 px-5 py-3">
            <button className="w-full text-center text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
