import { getCalendarEvents } from "@/lib/actions/calendar";
import { CalendarPageClient } from "./client";

export default async function CalendarPage() {
  // Server (UTC) month only picks which events to preload. The client decides
  // the visible month and "today" in the browser's time zone and fetches the
  // local month if it differs.
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const [eventsRes, nextRes] = await Promise.all([
    getCalendarEvents(month, year),
    getCalendarEvents(nextMonth, nextYear),
  ]);

  // Upcoming is filtered on the client from this month and next month, so it
  // uses the same rows as the grid (every status, not just "scheduled").
  const upcomingById = new Map(
    [...eventsRes.data, ...nextRes.data].map((e) => [e.id, e]),
  );

  return (
    <CalendarPageClient
      initialEvents={eventsRes.data}
      initialUpcoming={[...upcomingById.values()]}
      initialMonth={month}
      initialYear={year}
    />
  );
}
