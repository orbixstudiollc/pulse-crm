import { getPostPeerClient } from "@/lib/postpeer/client";
import { CalendarPageClient } from "./client";

export default async function CalendarPage() {
  try {
    // Initialize PostPeer client with API key from environment or database
    const apiKey = process.env.POSTPEER_API_KEY || "";

    if (!apiKey) {
      return (
        <div className="p-8">
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-6">
            <h2 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
              PostPeer Not Configured
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300">
              Please configure your PostPeer API key in environment variables.
            </p>
          </div>
        </div>
      );
    }

    // For now, return the client component with empty data
    // In production, fetch scheduled posts from PostPeer API
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return (
      <CalendarPageClient
        initialMonth={currentMonth}
        initialYear={currentYear}
      />
    );
  } catch (error) {
    console.error("Calendar page error:", error);
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-6">
          <h2 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
            Error Loading Calendar
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
        </div>
      </div>
    );
  }
}
