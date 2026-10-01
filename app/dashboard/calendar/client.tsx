"use client";

import {
  useState,
  useTransition,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  Button,
  ExportIcon,
  PlusIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  Skeleton,
} from "@/components/ui";
import { Page, PageHeader, DetailLayout, PanelSection } from "@/components/dashboard";
import { LogActivityModal, ActivityDetailDrawer } from "@/components/features";
import { cn } from "@/lib/utils";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/actions/calendar";
import { exportCalendarEventsToCSV } from "@/lib/actions/export";
import {
  DEFAULT_DURATION_MIN,
  eventWindow,
  toMinutes,
  upcomingEvents as selectUpcoming,
} from "@/lib/calendar/upcoming";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarEventType = "call" | "meeting" | "task" | "demo";

interface CalendarEventRecord {
  id: string;
  title: string;
  type: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
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
  /** HH:MM; 09:00 for an all-day event so the grid and forms have a time */
  startTime: string;
  /** No start_time: counts as upcoming for the whole day */
  allDay: boolean;
  durationMin: number;
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

function formatDurationLabel(durationMin: number): string {
  return durationMin >= 60
    ? `${durationMin / 60} hour${durationMin > 60 ? "s" : ""}`
    : `${durationMin} minutes`;
}

function computeEndTime(startTime: string, durationMin: number): string {
  const start = toMinutes(startTime) ?? 0;
  const end = Math.min(start + durationMin, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

// calendar_events has no duration/notes/location columns: duration lives in
// start_time/end_time, notes and location live in description.
function buildTimingAndDescription(data: Record<string, unknown>) {
  const durationMin = parseInt(data.duration as string) || DEFAULT_DURATION_MIN;
  const notes = (data.notes as string) || "";
  const location = ((data.location as string) || "").trim();
  return {
    start_time: data.time,
    end_time: computeEndTime(data.time as string, durationMin),
    description: location
      ? [notes, `Location: ${location}`].filter(Boolean).join("\n")
      : notes,
  };
}

function mapEvent(e: CalendarEventRecord): MappedEvent {
  const startMin = toMinutes(e.start_time);
  const endMin = toMinutes(e.end_time);
  const durationMin =
    startMin !== null && endMin !== null && endMin > startMin
      ? endMin - startMin
      : DEFAULT_DURATION_MIN;
  return {
    id: e.id,
    title: e.title || "",
    type: (e.type || "task") as CalendarEventType,
    date: e.date || "",
    startTime: (e.start_time || "09:00").slice(0, 5),
    allDay: startMin === null,
    durationMin,
    duration: formatDurationLabel(durationMin),
    status: e.status || "scheduled",
    notes: e.description || "",
    relatedTo: e.related_type
      ? {
          id: e.related_id || "",
          name: e.related_name || "",
          type: e.related_type,
        }
      : null,
  };
}

// Local-time YYYY-MM-DD (toISOString would shift the day to UTC).
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = toDateKey(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateKey(tomorrow);

  if (dateStr === todayStr) {
    return `TODAY, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
  }
  if (dateStr === tomorrowStr) {
    return `TOMORROW, ${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
  }
  return `${MONTHS[date.getMonth()].toUpperCase().slice(0, 3)} ${date.getDate()}`;
}

function formatTime(event: MappedEvent): string {
  if (event.allDay) return "All day";
  return eventWindow(event).start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(event: MappedEvent): string {
  const date = eventWindow(event).start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return event.allDay ? `${date}, all day` : `${date} at ${formatTime(event)}`;
}

const subscribeNoop = () => () => {};

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

  // "Today" and the default month come from the browser's time zone, so they
  // are only known after hydration (the server renders in UTC).
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const today = isMounted ? new Date() : null;

  // null = follow today's local month
  const [viewMonth, setViewMonth] = useState<{
    month: number;
    year: number;
  } | null>(null);
  const currentMonth =
    viewMonth?.month ?? (today ? today.getMonth() + 1 : initialMonth);
  const currentYear =
    viewMonth?.year ?? (today ? today.getFullYear() : initialYear);

  // Events plus the month they were loaded for (initialMonth/Year = server preload)
  const [loaded, setLoaded] = useState({
    month: initialMonth,
    year: initialYear,
    events: initialEvents,
  });
  const events = loaded.events;
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
  const [editEvent, setEditEvent] = useState<MappedEvent | null>(null);

  const mappedEvents = useMemo(() => events.map(mapEvent), [events]);

  const reloadEvents = async () => {
    const res = await getCalendarEvents(currentMonth, currentYear);
    if (res.data) {
      setLoaded({ month: currentMonth, year: currentYear, events: res.data });
    }
  };

  // Fetch events whenever the visible month is not the loaded one
  useEffect(() => {
    if (loaded.month === currentMonth && loaded.year === currentYear) return;

    let cancelled = false;
    (async () => {
      const res = await getCalendarEvents(currentMonth, currentYear);
      if (!cancelled && res.data) {
        setLoaded({ month: currentMonth, year: currentYear, events: res.data });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentMonth, currentYear, loaded.month, loaded.year]);

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

  // Every open event that has not ended yet, soonest first (the panel shows a
  // placeholder until the local time is known)
  const upcomingEvents = today
    ? selectUpcoming(initialUpcoming.map(mapEvent), today)
    : [];

  // Group upcoming events by date (insertion order keeps the sort)
  const groupedUpcoming = upcomingEvents.reduce(
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
      setViewMonth({ month: 12, year: currentYear - 1 });
    } else {
      setViewMonth({ month: currentMonth - 1, year: currentYear });
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setViewMonth({ month: 1, year: currentYear + 1 });
    } else {
      setViewMonth({ month: currentMonth + 1, year: currentYear });
    }
  };

  const goToToday = () => {
    setViewMonth(null);
  };

  // Handle schedule event
  const handleScheduleEvent = async (data: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await createCalendarEvent({
        title: data.title,
        type: data.type,
        date: data.date,
        ...buildTimingAndDescription(data),
        status: "scheduled",
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setShowScheduleModal(false);
        router.refresh();
        // Re-fetch events for current month
        await reloadEvents();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Handle edit event
  const handleEditEvent = async (data: Record<string, unknown>) => {
    if (!editEvent) return;
    startTransition(async () => {
      const result = await updateCalendarEvent(editEvent.id, {
        title: data.title,
        type: data.type,
        date: data.date,
        ...buildTimingAndDescription(data),
        related_type: (data.relatedTo as { type: string } | null)?.type,
        related_id: (data.relatedTo as { id: string } | null)?.id,
        related_name: (data.relatedTo as { name: string } | null)?.name,
      });
      if (!result.error) {
        setEditEvent(null);
        setShowScheduleModal(false);
        router.refresh();
        await reloadEvents();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleEventClick = (event: MappedEvent) => {
    setSelectedEvent(event);
    setShowEventDrawer(true);
  };

  return (
    <Page>
      {/* Header */}
      <PageHeader title="Calendar" icon={<CalendarBlankIcon size={18} />}>
        <Button
          variant="outline"
          leftIcon={<ExportIcon size={18} />}
          onClick={async () => {
            const result = await exportCalendarEventsToCSV(currentMonth, currentYear);
            if (result.error) { toast.error(result.error); return; }
            const blob = new Blob([result.csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `calendar-export-${currentYear}-${String(currentMonth).padStart(2, "0")}.csv`;
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
      <div className="flex items-center gap-2 px-8 pb-4 max-sm:px-4">
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
      <DetailLayout
        className="border-t border-divider"
        aside={
          <PanelSection title="Upcoming">
            <div className="space-y-6">
              {!isMounted ? (
                <div aria-hidden="true">
                  <Skeleton variant="text" width="35%" className="mb-3" />
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5">
                      <Skeleton variant="text" className="w-16 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="45%" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-fg-secondary">
                  No upcoming events
                </p>
              ) : (
                Object.entries(groupedUpcoming).map(([date, dateEvents]) => (
                  <div key={date}>
                    <h3 className="text-xs font-medium text-fg-secondary mb-3">
                      {formatDateLabel(date)}
                    </h3>
                    <div>
                      {dateEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full border-b border-divider py-2.5 text-left hover:bg-subtle transition-colors last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-sm text-fg-secondary w-16 shrink-0 whitespace-nowrap">
                              {formatTime(event)}
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
          </PanelSection>
        }
      >
        {/* Calendar Grid */}
        <div>
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-divider">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-xs font-medium text-fg-secondary border-r border-divider last:border-r-0"
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
                today !== null &&
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[110px] p-2 border-r border-b border-divider",
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
      </DetailLayout>

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
                meta: formatDateTime(selectedEvent),
                date: selectedEvent.date,
                time: selectedEvent.allDay ? null : selectedEvent.startTime,
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
              await reloadEvents();
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
    </Page>
  );
}
