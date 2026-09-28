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
            "flex-1 h-8 px-3 rounded-md text-sm font-medium transition-colors",
            mode === "now"
              ? "bg-accent-strong text-on-inverse"
              : "bg-muted text-fg hover:bg-active",
          )}
        >
          Post Now
        </button>
        <button
          onClick={() => setMode("schedule")}
          className={cn(
            "flex-1 h-8 px-3 rounded-md text-sm font-medium transition-colors",
            mode === "schedule"
              ? "bg-accent-strong text-on-inverse"
              : "bg-muted text-fg hover:bg-active",
          )}
        >
          Schedule
        </button>
      </div>

      {mode === "schedule" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">
                <CalendarBlankIcon className="inline w-4 h-4 mr-1" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full h-8 px-3 rounded-md border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg mb-2">
                <ClockIcon className="inline w-4 h-4 mr-1" />
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-8 px-3 rounded-md border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">
              Timezone
            </label>
            <select
              value={selectedTimezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full h-8 px-3 rounded-md border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
          </div>

          {date && time && !error && (
            <div className="p-3 rounded-md bg-accent-surface">
              <p className="text-sm text-accent-on-surface">
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
            <div className="p-3 rounded-md bg-danger-surface">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
