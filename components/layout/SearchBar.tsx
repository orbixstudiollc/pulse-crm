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
        className="flex md:hidden h-8 w-8 items-center justify-center rounded-md border border-line bg-surface transition-colors hover:bg-muted"
        aria-label="Search"
      >
        <MagnifyingGlassIcon size={16} className="text-fg-secondary" />
      </button>

      {/* Desktop: full search bar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex h-8 w-56 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-fg-secondary transition-colors hover:bg-muted"
      >
        <MagnifyingGlassIcon size={16} className="text-fg-secondary" />
        <span>Search...</span>
        <kbd className="ml-auto rounded-sm bg-code px-1.5 py-0.5 text-xs text-fg-secondary">
          ⌘K
        </kbd>
      </button>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
