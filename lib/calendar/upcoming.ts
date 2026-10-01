// Timing rules for the calendar's Upcoming panel. calendar_events stores a
// local date plus optional start/end times; an event without a start time is
// all-day (the grid and forms still show it at a default time).

export const DEFAULT_DURATION_MIN = 30;

const DONE_STATUSES = new Set(["completed", "cancelled"]);

export type EventTiming = {
  /** Local date, 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM[:SS]'; ignored for an all-day event */
  startTime: string;
  allDay: boolean;
  durationMin: number;
  status?: string | null;
};

export function toMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}

/** Local start and end of the event; an all-day event spans its whole day. */
export function eventWindow(event: EventTiming): { start: Date; end: Date } {
  const [y, m, d] = event.date.split("-").map(Number);
  const startMin = event.allDay ? null : toMinutes(event.startTime);
  if (startMin === null) {
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  }
  const start = new Date(y, m - 1, d, Math.floor(startMin / 60), startMin % 60);
  return { start, end: new Date(start.getTime() + event.durationMin * 60_000) };
}

/** Open (null status counts as open) and not over yet at `now`. */
export function isUpcoming(event: EventTiming, now: Date): boolean {
  if (event.status && DONE_STATUSES.has(event.status)) return false;
  return eventWindow(event).end > now;
}

/** Open events not over yet, soonest start first (all-day events lead their day). */
export function upcomingEvents<T extends EventTiming>(events: T[], now: Date): T[] {
  return events
    .filter((e) => isUpcoming(e, now))
    .sort((a, b) => eventWindow(a).start.getTime() - eventWindow(b).start.getTime());
}
