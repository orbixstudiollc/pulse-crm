"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarBlankIcon, XIcon } from "./Icons";
import { Button } from "./Button";

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const presetRanges = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", type: "month" as const },
  { label: "Last month", type: "lastMonth" as const },
];

export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localRange, setLocalRange] = useState<DateRange>(
    value || { start: null, end: null }
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handlePresetClick = (preset: (typeof presetRanges)[0]) => {
    const end = new Date();
    let start = new Date();

    if (preset.days) {
      start.setDate(end.getDate() - preset.days);
    } else if (preset.type === "month") {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (preset.type === "lastMonth") {
      start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      end.setDate(0); // Last day of previous month
    }

    const newRange = { start, end };
    setLocalRange(newRange);
  };

  const handleApply = () => {
    onChange?.(localRange);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setLocalRange(value || { start: null, end: null });
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedRange = { start: null, end: null };
    setLocalRange(clearedRange);
    onChange?.(clearedRange);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const displayValue =
    localRange.start && localRange.end
      ? `${formatDate(localRange.start)} - ${formatDate(localRange.end)}`
      : placeholder;

  const hasValue = localRange.start && localRange.end;

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
        className={cn(
          "h-8 w-full flex items-center justify-between rounded-md border bg-surface px-3 text-sm text-fg transition-colors duration-150 hover:bg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
          "border-line",
          !hasValue && "text-fg-muted"
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <CalendarBlankIcon className="h-4 w-4" />
          <span>{displayValue}</span>
        </div>
        {hasValue && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="text-fg-muted hover:text-fg-secondary"
            aria-label="Clear date range"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full min-w-[320px] rounded-lg border border-line bg-surface shadow-dropdown"
            role="dialog"
            aria-label="Date range picker"
          >
            <div className="p-3 space-y-3">
              {/* Preset Ranges */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-fg-secondary">
                  Quick Select
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {presetRanges.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="h-8 px-3 text-sm text-left text-fg rounded-md border border-line bg-surface hover:bg-muted transition-colors duration-150"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Range Inputs */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-fg-secondary">
                  Custom Range
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-fg-secondary mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={
                        localRange.start
                          ? localRange.start.toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const newDate = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        setLocalRange({ ...localRange, start: newDate });
                      }}
                      className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-fg-secondary mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={
                        localRange.end
                          ? localRange.end.toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const newDate = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        setLocalRange({ ...localRange, end: newDate });
                      }}
                      min={
                        localRange.start
                          ? localRange.start.toISOString().split("T")[0]
                          : undefined
                      }
                      className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-divider">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleApply}
                  disabled={!localRange.start || !localRange.end}
                >
                  Apply
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
