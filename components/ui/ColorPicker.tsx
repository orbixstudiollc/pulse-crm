"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./Icons";
import {
  COLOR_SWATCHES,
  DEFAULT_SWATCH,
  HEX_INPUT_PLACEHOLDER,
} from "@/lib/design-system/palette-data";

interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  label?: string;
  className?: string;
  presetColors?: string[];
  showRecentColors?: boolean;
}

const DEFAULT_PRESET_COLORS: string[] = [...COLOR_SWATCHES];

export function ColorPicker({
  value = DEFAULT_SWATCH,
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
        <label className="block text-sm font-medium text-fg mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 items-center gap-2 w-full rounded-md border border-line bg-surface px-3 text-sm transition-colors duration-150 hover:bg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Choose color"
      >
        <div
          className="w-4 h-4 rounded-sm border border-line"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <span className="flex-1 text-left text-fg">
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
            className="absolute z-50 mt-1 w-full min-w-[280px] rounded-lg border border-line bg-surface shadow-dropdown p-3"
            role="dialog"
            aria-label="Color picker"
          >
            <div className="space-y-4">
              {/* Hex Input */}
              <div>
                <label
                  htmlFor="hex-input"
                  className="block text-xs font-medium text-fg-secondary mb-1"
                >
                  Hex Color
                </label>
                <input
                  id="hex-input"
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  placeholder={HEX_INPUT_PLACEHOLDER}
                  maxLength={7}
                  className={cn(
                    "h-8 w-full rounded-md border bg-surface px-3 text-sm font-mono text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
                    isValidHex(hexInput)
                      ? "border-line"
                      : "border-danger"
                  )}
                  aria-invalid={!isValidHex(hexInput)}
                />
              </div>

              {/* Preset Colors */}
              <div>
                <p className="text-xs font-medium text-fg-secondary mb-2">
                  Preset Colors
                </p>
                <div className="grid grid-cols-10 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className="relative w-full aspect-square rounded-sm border border-line hover:scale-110 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
                  <p className="text-xs font-medium text-fg-secondary mb-2">
                    Recent Colors
                  </p>
                  <div className="grid grid-cols-10 gap-2">
                    {recentColors.map((color, index) => (
                      <button
                        key={`${color}-${index}`}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className="relative w-full aspect-square rounded-sm border border-line hover:scale-110 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
