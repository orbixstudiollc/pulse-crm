"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { signOut } from "@/lib/actions/auth";
import { getLeadCount } from "@/lib/actions/leads";
import { CaretDownIcon, GearIcon } from "../ui";
import { Progress } from "../ui/Progress";
import { useClickOutside } from "@/hooks";

export function HeaderUserMenu() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [leadCount, setLeadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const maxLeads = 100000;

  useClickOutside(menuRef, () => setOpen(false), open);

  useEffect(() => {
    getLeadCount().then((res) => setLeadCount(res.count));
  }, []);

  const displayName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      profile.email
    : "User";

  const orgName = displayName;
  const avatarUrl = profile?.avatar_url || "/images/avatars/user.jpg";

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5 transition-colors",
          "hover:bg-neutral-50 dark:hover:bg-neutral-900",
          open && "bg-neutral-50 dark:bg-neutral-900",
        )}
      >
        {/* Lead usage mini bar */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 mr-1">
          <span className="text-[11px] leading-none font-medium text-neutral-500 dark:text-neutral-400">
            {leadCount} / {maxLeads}
          </span>
          <Progress value={leadCount} max={maxLeads} size="sm" className="w-16" />
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* Avatar */}
        <Image
          src={avatarUrl}
          alt={orgName}
          width={28}
          height={28}
          quality={100}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />

        {/* Name + Plan */}
        <div className="hidden md:flex flex-col text-left leading-tight">
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate max-w-[120px]">
            {orgName}
          </span>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Pro Plan</span>
        </div>

        <CaretDownIcon
          size={14}
          className={cn(
            "text-neutral-400 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden z-50"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <Image
                  src={avatarUrl}
                  alt={orgName}
                  width={36}
                  height={36}
                  quality={100}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                    {orgName}
                  </div>
                  <div className="text-xs text-neutral-500">Pro Plan</div>
                </div>
              </div>
            </div>

            {/* Lead usage */}
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-neutral-600 dark:text-neutral-400">Leads</span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {leadCount} / {maxLeads}
                </span>
              </div>
              <Progress value={leadCount} max={maxLeads} size="sm" />
              <button className="mt-2 w-full text-xs font-medium text-neutral-950 dark:text-neutral-50 hover:underline text-center">
                Upgrade to Unlimited
              </button>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <GearIcon size={16} />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <path
                    d="M6 14H3.333A1.333 1.333 0 0 1 2 12.667V3.333A1.333 1.333 0 0 1 3.333 2H6M10.667 11.333 14 8l-3.333-3.333M14 8H6"
                    stroke="currentColor"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
