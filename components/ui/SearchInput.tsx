"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MagnifyingGlassIcon, XIcon, CircleNotchIcon } from "./Icons";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  url?: string;
}

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  results?: SearchResult[];
  onResultClick?: (result: SearchResult) => void;
  loading?: boolean;
  showShortcut?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  placeholder = "Search...",
  value = "",
  onChange,
  onSearch,
  results = [],
  onResultClick,
  loading = false,
  showShortcut = true,
  className,
  autoFocus = false,
}: SearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    // Handle Cmd+K / Ctrl+K shortcut
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    if (showShortcut) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showShortcut]);

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

  const handleInputChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange?.(newValue);
    setSelectedIndex(-1);

    if (newValue.trim()) {
      setIsOpen(true);
      onSearch?.(newValue);
    } else {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setLocalValue("");
    onChange?.("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result);
    setIsOpen(false);
    setLocalValue("");
    onChange?.("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const groupedResults = results.reduce(
    (acc, result) => {
      const category = result.category || "Results";
      if (!acc[category]) acc[category] = [];
      acc[category].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  const showResults = isOpen && (results.length > 0 || loading);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none">
          <MagnifyingGlassIcon className="h-4 w-4" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => localValue.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            "w-full rounded-lg border bg-white dark:bg-neutral-900 pl-10 pr-20 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600",
            "border-neutral-200 dark:border-neutral-800"
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="search-results"
          aria-activedescendant={
            selectedIndex >= 0 ? `result-${selectedIndex}` : undefined
          }
        />

        {/* Right Icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Loading Spinner */}
          {loading && (
            <CircleNotchIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500 animate-spin" />
          )}

          {/* Clear Button */}
          {localValue && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label="Clear search"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}

          {/* Keyboard Shortcut */}
          {showShortcut && !localValue && (
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-xs font-mono text-neutral-500 dark:text-neutral-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            id="search-results"
            role="listbox"
            className="absolute z-50 mt-2 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden"
          >
            <div className="max-h-[400px] overflow-y-auto">
              {loading && results.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-neutral-500 dark:text-neutral-400">
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    No results found
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Try a different search term
                  </p>
                </div>
              ) : (
                <div>
                  {Object.entries(groupedResults).map(
                    ([category, categoryResults]) => (
                      <div key={category}>
                        <div className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide bg-neutral-50 dark:bg-neutral-800/50">
                          {category}
                        </div>
                        <div className="py-1">
                          {categoryResults.map((result, index) => {
                            const globalIndex = results.indexOf(result);
                            const isSelected = globalIndex === selectedIndex;

                            return (
                              <button
                                key={result.id}
                                id={`result-${globalIndex}`}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleResultClick(result)}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                  isSelected
                                    ? "bg-indigo-50 dark:bg-indigo-900/20"
                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                )}
                              >
                                {result.icon && (
                                  <div className="flex-shrink-0 text-neutral-400 dark:text-neutral-500">
                                    {result.icon}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                    {result.title}
                                  </p>
                                  {result.description && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                      {result.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
