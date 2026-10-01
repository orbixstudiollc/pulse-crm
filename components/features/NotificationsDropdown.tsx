"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, CheckCircleIcon, ClockIcon, IconButton } from "@/components/ui";
import { useClickOutside } from "@/hooks";
import { formatRelativeTime } from "@/lib/utils";
import {
  listNotifications,
  markAllRead,
  markNotificationRead,
  unreadCount,
} from "@/lib/actions/notifications";
import type { NotificationKind, Tables } from "@/types/database";

type Notification = Tables<"notifications">;

const KIND_ICON: Record<NotificationKind, typeof BellIcon> = {
  task_result: CheckCircleIcon,
  approval_pending: ClockIcon,
};

// Header is a client component, so data is loaded here: the unread count once on
// mount (for the badge) and the list each time the dropdown opens. No polling.
export function NotificationsDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setOpen(false), open);

  useEffect(() => {
    unreadCount()
      .then(setUnread)
      .catch(() => setUnread(0));
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const rows = await listNotifications();
      setItems(rows);
      setUnread(rows.filter((n) => !n.read_at).length);
    } catch {
      // Keep whatever was shown last; the list is best effort.
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(n: Notification) {
    if (!n.read_at) {
      const result = await markNotificationRead(n.id);
      if ("success" in result) {
        const readAt = new Date().toISOString();
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: readAt } : x)));
        setUnread((c) => Math.max(0, c - 1));
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    const result = await markAllRead();
    if ("success" in result) {
      const readAt = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: readAt })));
      setUnread(0);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        icon={<BellIcon size={16} className="text-fg-secondary" />}
        aria-label="Notifications"
        badge={unread}
        onClick={toggle}
      />

      {open && (
        <div data-clay-box className="absolute right-0 top-full mt-1 w-96 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50">
          {/* Header */}
          <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
            <h3 className="text-sm font-semibold text-fg">
              Notifications
            </h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-sm text-fg-secondary hover:text-fg transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div data-clay-box className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface mb-3">
                <BellIcon size={16} className="text-fg-muted" />
              </div>
              <p className="text-sm font-medium text-fg mb-1">
                {loading ? "Loading…" : "You\u2019re all caught up"}
              </p>
              {!loading && (
                <span className="text-sm text-fg-secondary">
                  Notifications will appear here.
                </span>
              )}
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-divider">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? BellIcon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle"
                    >
                      <Icon size={16} className="mt-0.5 shrink-0 text-fg-secondary" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm text-fg ${n.read_at ? "" : "font-semibold"}`}>
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-2 block text-sm text-fg-secondary">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-fg-muted">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </span>
                      {!n.read_at && (
                        <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-strong" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
