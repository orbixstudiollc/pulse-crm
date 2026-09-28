"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./Icons";

interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  label?: string;
  className?: string;
  presetColors?: string[];
  showRecentColors?: boolean;
}

const DEFAULT_PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#EAB308", // yellow
  "#84CC16", // lime
  "#22C55E", // green
  "#10B981", // emerald
  "#14B8A6", // teal
  "#06B6D4", // cyan
  "#0EA5E9", // sky
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#A855F7", // purple
  "#D946EF", // fuchsia
  "#EC4899", // pink
  "#F43F5E", // rose
  "#64748B", // slate
  "#6B7280", // gray
  "#000000", // black
];

export function ColorPicker({
  value = "#3B82F6",
  onChange,
  label,
  className,
  presetColors = DEFAULT_PRESET_COLORS,
  showRecentColors = true,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  useEffect(() => {
    // Load recent colors from localStorage
    if (showRecentColors) {
      const stored = localStorage.getItem("recentColors");
      if (stored) {
        setRecentColors(JSON.parse(stored));
      }
    }
  }, [showRecentColors]);

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

  const isValidHex = (color: string): boolean => {
    return /^#[0-9A-F]{6}$/i.test(color);
  };

  const handleColorSelect = (color: string) => {
    onChange?.(color);
    setHexInput(color);
    addToRecentColors(color);
  };

  const handleHexInputChange = (value: string) => {
    let formatted = value.toUpperCase();
    if (!formatted.startsWith("#")) {
      formatted = `#${formatted}`;
    }
    setHexInput(formatted);

    if (isValidHex(formatted)) {
      onChange?.(formatted);
      addToRecentColors(formatted);
    }
  };

  const addToRecentColors = (color: string) => {
    if (!showRecentColors) return;

    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      const updated = [color, ...filtered].slice(0, 10);
      localStorage.setItem("recentColors", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Choose color"
      >
        <div
          className="w-6 h-6 rounded border border-neutral-300 dark:border-neutral-600"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <span className="flex-1 text-left text-neutral-900 dark:text-neutral-100">
          {value}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full min-w-[280px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg p-4"
            role="dialog"
            aria-label="Color picker"
          >
            <div className="space-y-4">
              {/* Hex Input */}
              <div>
                <label
                  htmlFor="hex-input"
                  className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5"
                >
                  Hex Color
                </label>
                <input
                  id="hex-input"
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  placeholder="#000000"
                  maxLength={7}
                  className={cn(
                    "w-full rounded-md border bg-white dark:bg-neutral-800 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600",
                    isValidHex(hexInput)
                      ? "border-neutral-200 dark:border-neutral-700"
                      : "border-red-300 dark:border-red-700"
                  )}
                  aria-invalid={!isValidHex(hexInput)}
                />
              </div>

              {/* Preset Colors */}
              <div>
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                  Preset Colors
                </p>
                <div className="grid grid-cols-10 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className="relative w-full aspect-square rounded border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                      style={{ backgroundColor: color }}
                      aria-label={color}
                      title={color}
                    >
                      {value === color && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CheckIcon className="h-4 w-4 text-white drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Colors */}
              {showRecentColors && recentColors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    Recent Colors
                  </p>
                  <div className="grid grid-cols-10 gap-2">
                    {recentColors.map((color, index) => (
                      <button
                        key={`${color}-${index}`}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className="relative w-full aspect-square rounded border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                        style={{ backgroundColor: color }}
                        aria-label={color}
                        title={color}
                      >
                        {value === color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckIcon className="h-4 w-4 text-white drop-shadow-md" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
