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
        className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-subtle hover:text-fg"
        aria-label="Search"
      >
        <MagnifyingGlassIcon size={16} />
      </button>

      {/* Desktop: full search bar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex h-8 w-56 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-subtle"
      >
        <MagnifyingGlassIcon size={16} className="shrink-0 text-fg-muted" />
        <span>Search...</span>
        <kbd className="ml-auto rounded-sm border border-line px-1.5 text-[12px] leading-4 text-fg-muted">
          ⌘K
        </kbd>
      </button>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
