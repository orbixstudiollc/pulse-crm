"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ClockIcon } from "./Icons";

interface TimePickerProps {
  value?: string; // HH:MM format (24-hour)
  onChange?: (time: string) => void;
  label?: string;
  use12Hour?: boolean;
  showPresets?: boolean;
  className?: string;
}

const TIME_PRESETS = [
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "2:00 PM", value: "14:00" },
  { label: "5:00 PM", value: "17:00" },
];

export function TimePicker({
  value = "09:00",
  onChange,
  label,
  use12Hour = true,
  showPresets = true,
  className,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState("09");
  const [minutes, setMinutes] = useState("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const containerRef = useRef<HTMLDivElement>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  // Parse value whenever it (or the 12h setting) changes — adjusted during render instead of in an effect
  const valueKey = `${value}|${use12Hour}`;
  if (valueKey !== syncedKey) {
    setSyncedKey(valueKey);
    if (value) {
      const [h, m] = value.split(":");
      const hour24 = parseInt(h, 10);

      if (use12Hour) {
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        setHours(hour12.toString().padStart(2, "0"));
        setPeriod(hour24 >= 12 ? "PM" : "AM");
      } else {
        setHours(h);
      }

      setMinutes(m);
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const convertTo24Hour = (hour: string, period: "AM" | "PM"): string => {
    let h = parseInt(hour, 10);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h.toString().padStart(2, "0");
  };

  const handleTimeChange = (newHours: string, newMinutes: string, newPeriod: "AM" | "PM") => {
    const hour24 = use12Hour ? convertTo24Hour(newHours, newPeriod) : newHours;
    const timeString = `${hour24}:${newMinutes}`;
    onChange?.(timeString);
  };

  const handleHourChange = (newHours: string) => {
    setHours(newHours);
    handleTimeChange(newHours, minutes, period);
  };

  const handleMinuteChange = (newMinutes: string) => {
    setMinutes(newMinutes);
    handleTimeChange(hours, newMinutes, period);
  };

  const handlePeriodToggle = () => {
    const newPeriod = period === "AM" ? "PM" : "AM";
    setPeriod(newPeriod);
    handleTimeChange(hours, minutes, newPeriod);
  };

  const handlePresetClick = (presetValue: string) => {
    const [h, m] = presetValue.split(":");
    const hour24 = parseInt(h, 10);

    if (use12Hour) {
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      setHours(hour12.toString().padStart(2, "0"));
      setPeriod(hour24 >= 12 ? "PM" : "AM");
    } else {
      setHours(h);
    }

    setMinutes(m);
    onChange?.(presetValue);
  };

  const formatDisplayTime = (): string => {
    if (use12Hour) {
      return `${hours}:${minutes} ${period}`;
    }
    return `${hours}:${minutes}`;
  };

  const hourOptions = use12Hour
    ? Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))
    : Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));

  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-fg mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 flex items-center gap-2 w-full rounded-md border border-line bg-surface px-3 text-sm transition-colors duration-150 hover:bg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Choose time"
      >
        <ClockIcon className="h-4 w-4 text-fg-muted" />
        <span className="flex-1 text-left text-fg">
          {formatDisplayTime()}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full min-w-[280px] rounded-lg border border-line bg-surface shadow-dropdown"
            role="dialog"
            aria-label="Time picker"
          >
            <div className="p-3 space-y-3">
              {/* Time Selectors */}
              <div className="flex items-center gap-2">
                {/* Hour Select */}
                <div className="flex-1">
                  <label
                    htmlFor="hour-select"
                    className="block text-xs text-fg-secondary mb-1"
                  >
                    Hour
                  </label>
                  <select
                    id="hour-select"
                    value={hours}
                    onChange={(e) => handleHourChange(e.target.value)}
                    className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-lg font-semibold text-fg-muted mt-5">
                  :
                </span>

                {/* Minute Select */}
                <div className="flex-1">
                  <label
                    htmlFor="minute-select"
                    className="block text-xs text-fg-secondary mb-1"
                  >
                    Minute
                  </label>
                  <select
                    id="minute-select"
                    value={minutes}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AM/PM Toggle */}
                {use12Hour && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handlePeriodToggle}
                      className="h-8 px-3 rounded-md border border-line bg-surface text-sm font-medium text-fg hover:bg-muted transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Switch to ${period === "AM" ? "PM" : "AM"}`}
                    >
                      {period}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              {showPresets && (
                <div className="pt-3 border-t border-divider">
                  <p className="text-xs font-medium text-fg-secondary mb-2">
                    Quick Select
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetClick(preset.value)}
                        className="h-8 px-3 text-sm text-left text-fg rounded-md border border-line bg-surface hover:bg-muted transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard Input */}
              <div className="pt-3 border-t border-divider">
                <label
                  htmlFor="time-input"
                  className="block text-xs text-fg-secondary mb-1"
                >
                  Or type time
                </label>
                <input
                  id="time-input"
                  type="time"
                  value={value}
                  onChange={(e) => onChange?.(e.target.value)}
                  className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
