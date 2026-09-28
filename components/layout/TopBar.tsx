"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BellIcon, MagnifyingGlassIcon, ListIcon } from "../ui/Icons";
import { useSidebar } from "./SidebarContext";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { cn } from "@/lib/utils";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const { openMobile } = useSidebar();
  const [notificationCount] = useState(3);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header
      className={cn(
        "flex h-16 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6",
        className
      )}
    >
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile hamburger */}
        <button
          onClick={openMobile}
          className="flex lg:hidden h-10 w-10 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Open menu"
        >
          <ListIcon size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <AnimatePresence>
            {showSearch ? (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                <input
                  type="text"
                  placeholder="Search..."
                  autoFocus
                  onBlur={() => setShowSearch(false)}
                  className="w-full h-10 px-4 pr-10 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                />
                <MagnifyingGlassIcon
                  size={18}
                  className="absolute right-3 text-neutral-400"
                />
              </motion.div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 h-10 px-4 text-sm text-neutral-500 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                <MagnifyingGlassIcon size={18} />
                <span className="hidden sm:inline">Search...</span>
              </button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Notifications + User Menu */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Notifications"
        >
          <BellIcon size={20} className="text-neutral-600 dark:text-neutral-400" />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* User Menu */}
        <HeaderUserMenu />
      </div>
    </header>
  );
}
