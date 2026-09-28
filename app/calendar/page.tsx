import { getPostPeerClient } from "@/lib/postpeer/client";
import { getOrgId } from "@/lib/actions/helpers";
import { CalendarPageClient } from "./client";

type CalendarData =
  | { error: string }
  | { error?: undefined; apiKey: string; currentMonth: number; currentYear: number };

function loadCalendarData(): CalendarData {
  try {
    // Initialize PostPeer client with API key from environment or database
    const apiKey = process.env.POSTPEER_API_KEY || "";

    // For now, return the client component with empty data
    // In production, fetch scheduled posts from PostPeer API
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return { apiKey, currentMonth, currentYear };
  } catch (error) {
    console.error("Calendar page error:", error);
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

export default async function CalendarPage() {
  await getOrgId();
  const data = loadCalendarData();

  if (data.error !== undefined) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-danger bg-danger-surface p-4 text-danger">
          <h2 className="text-sm font-semibold text-danger mb-1">
            Error Loading Calendar
          </h2>
          <p className="text-sm text-danger">
            {data.error}
          </p>
        </div>
      </div>
    );
  }

  const { apiKey, currentMonth, currentYear } = data;

  if (!apiKey) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-danger bg-danger-surface p-4 text-danger">
          <h2 className="text-sm font-semibold text-danger mb-1">
            PostPeer Not Configured
          </h2>
          <p className="text-sm text-danger">
            Please configure your PostPeer API key in environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p role="note" className="mx-4 mt-4 rounded-lg border border-warning bg-warning-surface p-3 text-sm text-warning">Preview with sample data — social scheduling is not connected.</p>
      <CalendarPageClient
        initialMonth={currentMonth}
        initialYear={currentYear}
      />
    </>
  );
}
