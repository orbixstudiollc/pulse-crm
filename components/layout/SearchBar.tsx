"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@/components/ui";
import { CommandPalette } from "../features";

/** Dispatched on window to open the command palette from outside the header. */
export const OPEN_SEARCH_EVENT = "pulse:open-search";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

export function SearchBar() {
  const [open, setOpen] = useState(false);

  // Handle ⌘K / Ctrl+K, and the sidebar's Search item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const handleOpen = () => setOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_SEARCH_EVENT, handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_SEARCH_EVENT, handleOpen);
    };
  }, []);

  return (
    <>
      {/* Below desktop: icon-only button. On desktop, Search sits in the sidebar. */}
      <button
        onClick={() => setOpen(true)}
        className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-subtle hover:text-fg"
        aria-label="Search"
      >
        <MagnifyingGlassIcon size={16} />
      </button>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
