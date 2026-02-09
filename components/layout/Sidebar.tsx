"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CaretDownIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  GaugeIcon,
  GearIcon,
  PulseIcon,
  SidebarSimpleIcon,
  UsersIcon,
  XIcon,
} from "../ui";
import Image from "next/image";
import { UpgradeCard } from "../features";
import { useSidebar } from "./SidebarContext";

const navigation = [
  { name: "Overview", href: "/dashboard/overview", icon: GaugeIcon },
  { name: "Customers", href: "/dashboard/customers", icon: UsersIcon },
  { name: "Leads", href: "/dashboard/leads", icon: FunnelIcon },
  { name: "Sales", href: "/dashboard/sales", icon: CurrencyDollarIcon },
  { name: "Activity", href: "/dashboard/activity", icon: PulseIcon },
  { name: "Settings", href: "/dashboard/settings", icon: GearIcon },
];

// ── Shared sidebar content ──────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onCollapse,
  onExpand,
  onNavClick,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-6",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <div className="relative flex items-center">
          <Link
            href="/dashboard/overview"
            className="relative flex items-center h-10"
            onClick={onNavClick}
          >
            <span
              className={cn(
                "font-serif text-4xl italic text-neutral-950 dark:text-neutral-50",
                "transition-all duration-300 ease-out",
                collapsed ? "scale-95" : "scale-100",
              )}
            >
              {collapsed ? "P" : "Pulse"}
            </span>
          </Link>
        </div>

        {!collapsed && (
          <button
            onClick={onCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Collapse sidebar"
          >
            <SidebarSimpleIcon
              weight="regular"
              size={20}
              className="text-neutral-500 dark:text-neutral-400"
            />
          </button>
        )}
      </div>

      {/* Toggle button (below logo when collapsed) */}
      {collapsed && (
        <div className="flex justify-center px-2 pb-4">
          <button
            onClick={onExpand}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Expand sidebar"
          >
            <SidebarSimpleIcon
              weight="regular"
              size={20}
              className="text-neutral-500 dark:text-neutral-400"
            />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-4", collapsed ? "px-3" : "px-5")}>
        <ul className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium border",
                    "transition-[background-color,color,box-shadow,border-color] duration-200 ease-in-out",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                    isActive
                      ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 border-neutral-200 dark:border-neutral-700 shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa]"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-all duration-200 ease-in-out",
                      collapsed
                        ? "opacity-90 scale-[1.05]"
                        : "opacity-100 scale-100",
                    )}
                    weight="regular"
                  />

                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                      collapsed
                        ? "max-w-0 opacity-0 ml-0"
                        : "max-w-37.5 opacity-100 ml-3",
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Upgrade Card */}
      <div
        className={cn(
          "mx-3 mb-4 transition-all duration-200 ease-in-out",
          collapsed
            ? "opacity-0 translate-y-2 pointer-events-none"
            : "opacity-100 translate-y-0",
        )}
      >
        <UpgradeCard current={847} max={2000} />
      </div>

      {/* User */}
      <div
        className={cn(
          "border-t border-neutral-200 dark:border-neutral-800",
          collapsed ? "py-5 px-3" : "py-6 px-5",
        )}
      >
        <div className="relative flex items-center gap-3">
          {/* Avatar */}
          <Image
            src="/images/avatars/user.jpg"
            alt="Angel Uriostegui"
            width={40}
            height={40}
            className={cn(
              "h-10 w-10 shrink-0 rounded-full object-cover transition-transform duration-200 ease-in-out",
              collapsed ? "mx-auto" : "",
            )}
          />

          {/* User info */}
          <div
            className={cn(
              "flex-1 overflow-hidden space-y-1 transition-all duration-200 ease-in-out",
              collapsed
                ? "w-0 opacity-0 translate-x-2 pointer-events-none"
                : "w-auto opacity-100 translate-x-0",
            )}
          >
            <div className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              Angel Uriostegui
            </div>
            <div className="text-xs text-neutral-500">Pro Plan</div>
          </div>

          {/* Caret */}
          <CaretDownIcon
            className={cn(
              "h-4 w-4 text-neutral-500 transition-opacity duration-150",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          />
        </div>
      </div>
    </>
  );
}

// ── Desktop Sidebar (inline, collapsible) ───────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-18" : "w-60",
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onCollapse={() => setCollapsed(true)}
        onExpand={() => setCollapsed(false)}
      />
    </aside>
  );
}

// ── Mobile Sidebar (overlay drawer) ─────────────────────────────────────────

export function MobileSidebar() {
  const { mobileOpen, closeMobile } = useSidebar();
  const pathname = usePathname();

  // Close when route changes
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  // Lock body scroll when open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <AnimatePresence>
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobile}
          />

          {/* Sidebar panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-60 bg-neutral-100 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 z-50 flex flex-col lg:hidden"
          >
            <SidebarContent
              collapsed={false}
              onCollapse={closeMobile}
              onExpand={() => {}}
              onNavClick={closeMobile}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
