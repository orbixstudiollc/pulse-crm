"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CalendarBlankIcon, ClockIcon } from "@/components/ui/Icons";

interface SchedulePickerProps {
  scheduledAt?: string;
  timezone?: string;
  onChange: (scheduledAt: string | undefined, timezone: string) => void;
  className?: string;
}

const COMMON_TIMEZONES = [
  { label: "Eastern Time", value: "America/New_York" },
  { label: "Central Time", value: "America/Chicago" },
  { label: "Mountain Time", value: "America/Denver" },
  { label: "Pacific Time", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
  { label: "London", value: "Europe/London" },
  { label: "Paris", value: "Europe/Paris" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
];

export function SchedulePicker({
  scheduledAt,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onChange,
  className,
}: SchedulePickerProps) {
  const [mode, setMode] = useState<"now" | "schedule">(
    scheduledAt ? "schedule" : "now",
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scheduledAt) {
      const dt = new Date(scheduledAt);
      setDate(dt.toISOString().split("T")[0]);
      setTime(dt.toTimeString().slice(0, 5));
    }
  }, [scheduledAt]);

  useEffect(() => {
    if (mode === "now") {
      onChange(undefined, selectedTimezone);
      setError(null);
      return;
    }

    if (!date || !time) {
      setError("Please select both date and time");
      return;
    }

    const scheduledDate = new Date(`${date}T${time}`);
    const now = new Date();

    if (scheduledDate <= now) {
      setError("Scheduled time must be in the future");
      onChange(undefined, selectedTimezone);
      return;
    }

    setError(null);
    onChange(scheduledDate.toISOString(), selectedTimezone);
  }, [mode, date, time, selectedTimezone, onChange]);

  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz);
    if (date && time) {
      const dt = new Date(`${date}T${time}`);
      onChange(dt.toISOString(), tz);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex gap-2">
        <button
          onClick={() => setMode("now")}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "now"
              ? "bg-indigo-600 text-white"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700",
          )}
        >
          Post Now
        </button>
        <button
          onClick={() => setMode("schedule")}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "schedule"
              ? "bg-indigo-600 text-white"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700",
          )}
        >
          Schedule
        </button>
      </div>

      {mode === "schedule" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                <CalendarBlankIcon className="inline w-4 h-4 mr-1" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                <ClockIcon className="inline w-4 h-4 mr-1" />
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Timezone
            </label>
            <select
              value={selectedTimezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
          </div>

          {date && time && !error && (
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                Scheduled for{" "}
                {new Date(`${date}T${time}`).toLocaleString(undefined, {
                  timeZone: selectedTimezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                ({selectedTimezone})
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
