"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { signOut } from "@/lib/actions/auth";
import { CaretDownIcon, GearIcon } from "../ui";
import { useClickOutside } from "@/hooks";

export function HeaderUserMenu() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  // Testing phase: guests have no account to sign out of, and their synthetic
  // email is not worth showing.
  const openAccess = process.env.NEXT_PUBLIC_OPEN_ACCESS === "true";
  const displayName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      (openAccess ? "Guest" : profile.email)
    : openAccess ? "Guest" : "User";

  const orgName = displayName;
  const roleLabel = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : null;
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
          "flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2 transition-colors duration-150",
          "hover:bg-muted",
          open && "bg-muted",
        )}
      >
        {/* Avatar */}
        <Image
          src={avatarUrl}
          alt={orgName}
          width={20}
          height={20}
          quality={100}
          className="h-5 w-5 shrink-0 rounded-full object-cover"
        />

        {/* Name + Role */}
        <div className="hidden md:flex items-baseline gap-1.5 text-left">
          <span className="text-sm font-medium text-fg truncate max-w-[120px]">
            {orgName}
          </span>
          {roleLabel && (
            <span className="text-xs text-fg-secondary whitespace-nowrap">{roleLabel}</span>
          )}
        </div>

        <CaretDownIcon
          size={14}
          className={cn(
            "text-fg-muted transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50"
          >
            {/* User info header */}
            <div className="px-3 py-3 border-b border-divider">
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
                  <div className="text-sm font-medium text-fg truncate">
                    {orgName}
                  </div>
                  {roleLabel && (
                    <div className="text-xs text-fg-secondary">{roleLabel}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1">
              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-fg hover:bg-muted transition-colors"
              >
                <GearIcon size={16} />
                Settings
              </Link>
              {!openAccess && (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-danger hover:bg-danger-surface transition-colors"
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
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
