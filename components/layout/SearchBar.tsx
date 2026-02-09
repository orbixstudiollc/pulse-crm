"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@/components/ui";
import { CommandPalette } from "../features";

export function SearchBar() {
  const [open, setOpen] = useState(false);

  // Handle ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Mobile: icon-only button */}
      <button
        onClick={() => setOpen(true)}
        className="flex md:hidden h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        aria-label="Search"
      >
        <MagnifyingGlassIcon size={20} className="text-neutral-500" />
      </button>

      {/* Desktop: full search bar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex h-11 w-60 items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <MagnifyingGlassIcon size={16} className="text-neutral-500" />
        <span className="text-sm text-neutral-500">Search...</span>
        <kbd className="ml-auto rounded-sm border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          ⌘K
        </kbd>
      </button>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
