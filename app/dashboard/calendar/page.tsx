"use client";

import { useState } from "react";
import {
  Button,
  ExportIcon,
  PlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { LogActivityModal, ActivityDetailDrawer } from "@/components/features";
import {
  calendarEvents,
  eventTypeBgColors,
  eventDotColors,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 0, 1)); // January 2025
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  // Get calendar grid data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Build calendar grid (6 weeks x 7 days)
  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the first of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get events for a specific day
  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarEvents.filter((event) => event.date === dateStr);
  };

  // Get upcoming events
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const upcomingEvents = calendarEvents
    .filter((event) => event.status === "scheduled")
    .sort((a, b) => {
      if (a.date === b.date) return a.time.localeCompare(b.time);
      return a.date.localeCompare(b.date);
    })
    .slice(0, 10);

  // Group upcoming events by date
  const groupedUpcoming = upcomingEvents.reduce(
    (acc, event) => {
      const date = event.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, CalendarEvent[]>,
  );

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format date for display
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    if (dateStr === todayStr) {
      return `TODAY, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
    }

    if (dateStr === tomorrowStr) {
      return `TOMORROW, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
    }

    return `${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
  };

  // Format time for display
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes}`;
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDrawer(true);
  };

  return (
    <div className="p-8">
      {/* Header - Full Width */}
      <PageHeader title="Calendar">
        <Button variant="outline" leftIcon={<ExportIcon size={18} />}>
          Export
        </Button>
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => {
            setEditEvent(null);
            setShowScheduleModal(true);
          }}
        >
          Schedule Event
        </Button>
      </PageHeader>

      {/* Calendar Navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <CaretLeftIcon
            size={16}
            className="text-neutral-600 dark:text-neutral-400"
          />
        </button>
        <div className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 min-w-[140px] text-center">
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {MONTHS[month]} {year}
          </span>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <CaretRightIcon
            size={16}
            className="text-neutral-600 dark:text-neutral-400"
          />
        </button>
        <button
          onClick={goToToday}
          className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
            Today
          </span>
        </button>
      </div>

      {/* Calendar + Upcoming Sidebar */}
      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const events = day ? getEventsForDay(day) : [];
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[110px] p-2 border-r border-b border-neutral-200 dark:border-neutral-800",
                    "[&:nth-child(7n)]:border-r-0",
                    !day && "bg-neutral-50 dark:bg-neutral-900/50",
                  )}
                >
                  {day && (
                    <>
                      {/* Day Number */}
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-7 h-7 text-sm",
                          isToday
                            ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950 rounded-full font-medium"
                            : "text-neutral-950 dark:text-neutral-50",
                        )}
                      >
                        {day}
                      </span>

                      {/* Events */}
                      <div className="mt-1 space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <button
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className={cn(
                              "w-full px-2 py-1 rounded text-xs font-medium text-left truncate transition-opacity hover:opacity-80",
                              eventTypeBgColors[
                                event.type as CalendarEventType
                              ],
                            )}
                          >
                            {event.title}
                          </button>
                        ))}
                        {events.length > 2 && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 pl-2">
                            +{events.length - 2} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Sidebar */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50 mb-5">
              Upcoming
            </h2>

            <div className="space-y-6">
              {Object.entries(groupedUpcoming).map(([date, events]) => (
                <div key={date}>
                  <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                    {formatDateLabel(date)}
                  </h3>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400 w-11 shrink-0">
                            {formatTime(event.time)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                              {event.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  eventDotColors[
                                    event.type as CalendarEventType
                                  ],
                                )}
                              />
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                {event.type.charAt(0).toUpperCase() +
                                  event.type.slice(1)}{" "}
                                · {event.duration}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Event Modal */}
      <LogActivityModal
        key={editEvent ? `edit-${editEvent.id}` : "create"}
        open={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditEvent(null);
        }}
        mode={editEvent ? "edit" : "create"}
        variant="event"
        initialData={
          editEvent
            ? {
                type: editEvent.type as "call" | "meeting" | "task" | "demo",
                title: editEvent.title,
                relatedTo: editEvent.relatedTo || null,
                date: editEvent.date,
                time: editEvent.time,
                duration: editEvent.duration.includes("hour")
                  ? "60"
                  : editEvent.duration.replace(/\D/g, ""),
                notes: editEvent.notes || "",
              }
            : undefined
        }
        onSubmit={(data) => {
          console.log("Event saved:", data);
        }}
      />

      {/* Event Details Drawer */}
      <ActivityDetailDrawer
        open={showEventDrawer}
        onClose={() => {
          setShowEventDrawer(false);
          setSelectedEvent(null);
        }}
        activity={
          selectedEvent
            ? {
                id: selectedEvent.id,
                type: selectedEvent.type as "call" | "meeting" | "task",
                title: selectedEvent.title,
                description: selectedEvent.notes || "",
                badge: {
                  label:
                    selectedEvent.status === "completed"
                      ? "Completed"
                      : "Scheduled",
                  variant:
                    selectedEvent.status === "completed" ? "neutral" : "green",
                },
                meta: `${selectedEvent.date} at ${selectedEvent.time}`,
              }
            : null
        }
        customerName={selectedEvent?.relatedTo?.name || ""}
        onMarkComplete={() => {
          console.log("Complete event:", selectedEvent?.id);
          setShowEventDrawer(false);
        }}
        onReschedule={() => {
          setEditEvent(selectedEvent);
          setShowEventDrawer(false);
          setShowScheduleModal(true);
        }}
      />
    </div>
  );
}
