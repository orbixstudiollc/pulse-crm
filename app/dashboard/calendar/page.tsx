import { getCalendarEvents, getUpcomingEvents } from "@/lib/actions/calendar";
import { CalendarPageClient } from "./client";

export default async function CalendarPage() {
  // Server (UTC) month only picks which events to preload. The client decides
  // the visible month and "today" in the browser's time zone and fetches the
  // local month if it differs.
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();

  // Upcoming covers every open future event, not just the grid's months; the
  // client trims it to "from now onward" in local time.
  const [eventsRes, upcomingRes] = await Promise.all([
    getCalendarEvents(month, year),
    getUpcomingEvents(),
  ]);

  return (
    <CalendarPageClient
      initialEvents={eventsRes.data}
      initialUpcoming={upcomingRes.data}
      initialMonth={month}
      initialYear={year}
    />
  );
}
