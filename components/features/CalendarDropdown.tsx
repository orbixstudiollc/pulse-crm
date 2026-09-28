"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  CalendarBlankIcon,
  IconButton,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowRightIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks";
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

// Sample events - in real app this would come from props or API
const events: Record<string, number> = {
  "2025-01-15": 2,
  "2025-01-18": 1,
  "2025-01-22": 3,
  "2025-01-25": 1,
  "2025-01-30": 2,
  "2025-02-03": 1,
  "2025-02-10": 2,
  "2025-02-14": 1,
};

export function CalendarDropdown() {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Date();

  useClickOutside(dropdownRef, () => setOpen(false), open);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

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
    const d = new Date(year, month + monthOffset, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
                const hasEvents = events[dateKey];
                const isTodayDate = isCurrentMonth && isToday(day);

                return (
                  <button
                    key={index}
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
