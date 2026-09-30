"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarBlankIcon,
  IconButton,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowRightIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks";
import { getCalendarEvents } from "@/lib/actions/calendar";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const UPCOMING_LIMIT = 4;

interface CalendarEventSummary {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
}

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarDropdown() {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventSummary[]>([]);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Date();

  useClickOutside(dropdownRef, () => setOpen(false), open);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Load real events for the displayed month whenever the popover opens or the
  // month changes. getCalendarEvents takes a 1-based month.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCalendarEvents(month + 1, year).then((res) => {
      if (!cancelled) setEvents(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, month, year]);

  const eventCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] ?? 0) + 1;
    return acc;
  }, {});

  const todayKey = toDateKey(today);
  const upcomingEvents = events
    .filter((e) => e.date >= todayKey)
    .slice(0, UPCOMING_LIMIT);

  const goToCalendar = () => {
    setOpen(false);
    router.push("/dashboard/calendar");
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateKey = (day: number, monthOffset: number = 0) => {
    return toDateKey(new Date(year, month + monthOffset, day));
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Build calendar grid
  const calendarDays: {
    day: number;
    isCurrentMonth: boolean;
    dateKey: string;
  }[] = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    calendarDays.push({
      day,
      isCurrentMonth: false,
      dateKey: formatDateKey(day, -1),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      dateKey: formatDateKey(day),
    });
  }

  // Next month days
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      dateKey: formatDateKey(day, 1),
    });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        icon={
          <CalendarBlankIcon size={16} className="text-fg-secondary" />
        }
        aria-label="Calendar"
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50">
          {/* Header */}
          <div className="flex h-12 items-center justify-between px-3 border-b border-divider">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <CaretLeftIcon
                size={16}
                className="text-fg-secondary"
              />
            </button>

            <button
              onClick={goToToday}
              className="text-sm font-semibold text-fg hover:text-fg-secondary transition-colors"
            >
              {MONTHS[month]} {year}
            </button>

            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <CaretRightIcon
                size={16}
                className="text-fg-secondary"
              />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="p-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-fg-muted py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map(({ day, isCurrentMonth, dateKey }, index) => {
                const hasEvents = eventCounts[dateKey];
                const isTodayDate = isCurrentMonth && isToday(day);

                return (
                  <button
                    key={index}
                    onClick={goToCalendar}
                    className={cn(
                      "relative flex flex-col items-center justify-center h-9 rounded-md text-sm transition-colors",
                      isCurrentMonth
                        ? "text-fg hover:bg-muted"
                        : "text-fg-disabled",
                      isTodayDate &&
                        "bg-inverse text-on-inverse hover:bg-inverse",
                    )}
                  >
                    {day}
                    {hasEvents && isCurrentMonth && (
                      <span
                        className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          isTodayDate
                            ? "bg-on-inverse"
                            : "bg-inverse",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="border-t border-divider px-4 py-3">
            <div className="text-xs font-medium text-fg-secondary mb-2">
              Upcoming
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-fg-muted">No upcoming events</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-fg truncate">{event.title}</span>
                    <span className="text-xs text-fg-secondary whitespace-nowrap tabular-nums">
                      {event.date.slice(5)}
                      {event.start_time ? ` ${event.start_time.slice(0, 5)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-divider bg-subtle px-4 py-2.5">
            <Link
              href="/dashboard/calendar"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 text-xs font-medium text-fg-secondary hover:text-fg transition-colors"
            >
              View full calendar
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
