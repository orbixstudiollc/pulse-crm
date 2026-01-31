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
          <CalendarBlankIcon
            size={20}
            className="text-neutral-600 dark:text-neutral-400"
          />
        }
        aria-label="Calendar"
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <CaretLeftIcon
                size={16}
                className="text-neutral-600 dark:text-neutral-400"
              />
            </button>

            <button
              onClick={goToToday}
              className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {MONTHS[month]} {year}
            </button>

            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <CaretRightIcon
                size={16}
                className="text-neutral-600 dark:text-neutral-400"
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
                  className="text-center text-xs font-medium text-neutral-400 dark:text-neutral-500 py-2"
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
                      "relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-colors",
                      isCurrentMonth
                        ? "text-neutral-950 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        : "text-neutral-300 dark:text-neutral-600",
                      isTodayDate &&
                        "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-200",
                    )}
                  >
                    {day}
                    {hasEvents && isCurrentMonth && (
                      <span
                        className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          isTodayDate
                            ? "bg-white dark:bg-neutral-950"
                            : "bg-neutral-950 dark:bg-neutral-50",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3">
            <Link
              href="/dashboard/calendar"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
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
