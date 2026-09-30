"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  Button,
  ExportIcon,
  PlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { LogActivityModal, ActivityDetailDrawer } from "@/components/features";
import { cn } from "@/lib/utils";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/actions/calendar";
import { exportCalendarEventsToCSV } from "@/lib/actions/export";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarEventType = "call" | "meeting" | "task" | "demo";

interface CalendarEventRecord {
  id: string;
  title: string;
  type: string;
  date: string;
  duration?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  notes?: string | null;
  description?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  related_name?: string | null;
  [key: string]: unknown;
}

interface MappedEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  startTime: string;
  duration: string;
  status: string;
  notes: string;
  relatedTo: { id: string; name: string; type: string } | null;
}

// ── Display Config ────────────────────────────────────────────────────────────

const eventTypeBgColors: Record<CalendarEventType, string> = {
  call: "bg-accent-surface text-accent-on-surface",
  meeting:
    "bg-accent-surface text-accent-on-surface",
  task: "bg-warning-surface text-warning",
  demo: "bg-danger-surface text-danger",
};

const eventDotColors: Record<CalendarEventType, string> = {
  call: "bg-accent-strong",
  meeting: "bg-accent-strong",
  task: "bg-success",
  demo: "bg-warning",
};

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapEvent(e: CalendarEventRecord): MappedEvent {
  return {
    id: e.id,
    title: e.title || "",
    type: (e.type || "task") as CalendarEventType,
    date: e.date || "",
    startTime: (e.start_time || "09:00").slice(0, 5),
    duration: e.duration || "30 minutes",
    status: e.status || "scheduled",
    notes: (e.notes as string) || "",
    relatedTo: e.related_type
      ? {
          id: e.related_id || "",
          name: e.related_name || "",
          type: e.related_type,
        }
      : null,
  };
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = today.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) {
    return `TODAY, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
  }
  if (dateStr === tomorrowStr) {
    return `TOMORROW, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
  }
  return `${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CalendarPageClient({
  initialEvents,
  initialUpcoming,
  initialMonth,
  initialYear,
}: {
  initialEvents: CalendarEventRecord[];
  initialUpcoming: CalendarEventRecord[];
  initialMonth: number;
  initialYear: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [events, setEvents] = useState<CalendarEventRecord[]>(initialEvents);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
  const [editEvent, setEditEvent] = useState<MappedEvent | null>(null);

  const mappedEvents = useMemo(() => events.map(mapEvent), [events]);
  const mappedUpcoming = useMemo(
    () => initialUpcoming.map(mapEvent),
    [initialUpcoming],
  );

  // Re-fetch events when month changes
  useEffect(() => {
    if (
      currentMonth === initialMonth &&
      currentYear === initialYear
    )
      return;

    let cancelled = false;
    (async () => {
      const res = await getCalendarEvents(currentMonth, currentYear);
      if (!cancelled && res.data) {
        setEvents(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentMonth, currentYear, initialMonth, initialYear]);

  // Calendar grid
  const month = currentMonth - 1; // 0-based for Date constructor
  const year = currentYear;
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const getEventsForDay = (day: number): MappedEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return mappedEvents.filter((e) => e.date === dateStr);
  };

  const today = new Date();

  // Group upcoming events by date
  const groupedUpcoming = mappedUpcoming.reduce(
    (acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    },
    {} as Record<string, MappedEvent[]>,
  );

  // Navigation
  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
  };

  // Handle schedule event
  const handleScheduleEvent = async (data: Record<string, unknown>) => {
    startTransition(async () => {
      const durationMin = parseInt(data.duration as string) || 30;
      const durationLabel =
        durationMin >= 60
          ? `${durationMin / 60} hour${durationMin > 60 ? "s" : ""}`
          : `${durationMin} minutes`;

      const result = await createCalendarEvent({
        title: data.title,
        type: data.type,
        date: data.date,
        start_time: data.time,
        duration: durationLabel,
        status: "scheduled",
        notes: data.notes || "",
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setShowScheduleModal(false);
        router.refresh();
        // Re-fetch events for current month
        const res = await getCalendarEvents(currentMonth, currentYear);
        if (res.data) setEvents(res.data);
      }
    });
  };

  // Handle edit event
  const handleEditEvent = async (data: Record<string, unknown>) => {
    if (!editEvent) return;
    startTransition(async () => {
      const durationMin = parseInt(data.duration as string) || 30;
      const durationLabel =
        durationMin >= 60
          ? `${durationMin / 60} hour${durationMin > 60 ? "s" : ""}`
          : `${durationMin} minutes`;

      const result = await updateCalendarEvent(editEvent.id, {
        title: data.title,
        type: data.type,
        date: data.date,
        start_time: data.time,
        duration: durationLabel,
        notes: data.notes || "",
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setEditEvent(null);
        setShowScheduleModal(false);
        router.refresh();
        const res = await getCalendarEvents(currentMonth, currentYear);
        if (res.data) setEvents(res.data);
      }
    });
  };

  const handleEventClick = (event: MappedEvent) => {
    setSelectedEvent(event);
    setShowEventDrawer(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-6">
      {/* Header */}
      <PageHeader title="Calendar">
        <Button
          variant="outline"
          leftIcon={<ExportIcon size={18} />}
          onClick={async () => {
            const result = await exportCalendarEventsToCSV(currentMonth, currentYear);
            if (result.error) { toast.error(result.error); return; }
            const blob = new Blob([result.csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `calendar-export-${currentYear}-${String(currentMonth + 1).padStart(2, "0")}.csv`;
            a.click(); URL.revokeObjectURL(url);
            toast.success("Calendar events exported successfully");
          }}
        >
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
          className="p-2 rounded border border-line hover:bg-muted transition-colors"
        >
          <CaretLeftIcon
            size={16}
            className="text-fg-secondary"
          />
        </button>
        <div className="px-4 py-2 rounded border border-line min-w-[140px] text-center">
          <span className="text-sm font-medium text-fg">
            {MONTHS[month]} {year}
          </span>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded border border-line hover:bg-muted transition-colors"
        >
          <CaretRightIcon
            size={16}
            className="text-fg-secondary"
          />
        </button>
        <button
          onClick={goToToday}
          className="px-4 py-2 rounded border border-line hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium text-fg">
            Today
          </span>
        </button>
      </div>

      {/* Calendar + Upcoming Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 rounded-lg border border-line bg-surface overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-line">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-xs font-medium text-fg-secondary border-r border-row last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[110px] p-2 border-r border-b border-row",
                    "[&:nth-child(7n)]:border-r-0",
                    !day && "bg-subtle",
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-7 h-7 text-sm",
                          isToday
                            ? "bg-accent-surface text-accent-on-surface rounded-full font-medium"
                            : "text-fg",
                        )}
                      >
                        {day}
                      </span>

                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <button
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className={cn(
                              "w-full px-2 py-1 rounded text-xs font-medium text-left truncate transition-opacity hover:opacity-80",
                              eventTypeBgColors[event.type] ||
                                eventTypeBgColors.task,
                            )}
                          >
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-fg-secondary pl-2">
                            +{dayEvents.length - 2} more
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
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-lg font-semibold text-fg mb-5">
              Upcoming
            </h2>

            <div className="space-y-6">
              {Object.entries(groupedUpcoming).length === 0 ? (
                <p className="text-sm text-fg-secondary">
                  No upcoming events
                </p>
              ) : (
                Object.entries(groupedUpcoming).map(([date, dateEvents]) => (
                  <div key={date}>
                    <h3 className="text-xs font-medium text-fg-secondary mb-3">
                      {formatDateLabel(date)}
                    </h3>
                    <div className="space-y-2">
                      {dateEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full p-3 rounded border border-line hover:bg-muted transition-colors text-left"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-sm text-fg-secondary w-11 shrink-0">
                              {formatTime(event.startTime)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-fg truncate">
                                {event.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    eventDotColors[event.type] ||
                                      eventDotColors.task,
                                  )}
                                />
                                <span className="text-xs text-fg-secondary">
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
                ))
              )}
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
                relatedTo: editEvent.relatedTo
                  ? {
                      id: editEvent.relatedTo.id,
                      name: editEvent.relatedTo.name,
                      type: editEvent.relatedTo.type as
                        | "customer"
                        | "lead"
                        | "deal",
                    }
                  : null,
                date: editEvent.date,
                time: editEvent.startTime,
                duration: editEvent.duration.includes("hour")
                  ? "60"
                  : editEvent.duration.replace(/\D/g, ""),
                notes: editEvent.notes || "",
              }
            : undefined
        }
        onSubmit={editEvent ? handleEditEvent : handleScheduleEvent}
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
                    selectedEvent.status === "completed" ? "neutral" : "success",
                },
                meta: `${selectedEvent.date} at ${selectedEvent.startTime}`,
              }
            : null
        }
        customerName={selectedEvent?.relatedTo?.name || ""}
        onMarkComplete={() => {
          if (selectedEvent) {
            startTransition(async () => {
              await updateCalendarEvent(selectedEvent.id, {
                status: "completed",
              });
              setShowEventDrawer(false);
              router.refresh();
              const res = await getCalendarEvents(currentMonth, currentYear);
              if (res.data) setEvents(res.data);
            });
          }
        }}
        onReschedule={() => {
          if (selectedEvent) {
            setEditEvent(selectedEvent);
            setShowEventDrawer(false);
            setShowScheduleModal(true);
          }
        }}
      />
    </div>
  );
}
