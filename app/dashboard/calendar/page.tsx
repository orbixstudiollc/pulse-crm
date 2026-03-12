import {
  getCalendarEvents,
  getUpcomingEvents,
} from "@/lib/actions/calendar";
import { CalendarPageClient } from "./client";

export default async function CalendarPage() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();

  const [eventsRes, upcomingRes] = await Promise.all([
    getCalendarEvents(month, year),
    getUpcomingEvents(10),
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
