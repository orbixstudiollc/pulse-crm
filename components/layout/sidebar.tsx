"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Gauge,
  Users,
  Funnel,
  CurrencyDollar,
  Activity,
  Gear,
  CaretDown,
  SidebarSimple,
} from "phosphor-react";
import { UpgradeCard } from "../upgrade-card";
import Image from "next/image";

const navigation = [
  { name: "Overview", href: "/dashboard/overview", icon: Gauge },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Leads", href: "/dashboard/leads", icon: Funnel },
  { name: "Sales", href: "/dashboard/sales", icon: CurrencyDollar },
  { name: "Activity", href: "/dashboard/activity", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Gear },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-18" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-6",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <div className="relative flex items-center">
          {/* Full logo */}
          <span
            className={cn(
              "absolute left-0 font-serif text-4xl italic text-neutral-950 dark:text-neutral-50",
              "transition-all duration-200 ease-in-out",
              collapsed
                ? "opacity-0 translate-x-2 pointer-events-none"
                : "opacity-100 translate-x-0",
            )}
          >
            Pulse
          </span>

          {/* Collapsed logo */}
          <span
            className={cn(
              "font-serif text-4xl italic text-neutral-950 dark:text-neutral-50",
              "transition-all duration-200 ease-in-out",
              collapsed
                ? "opacity-100 translate-x-0 scale-105 tracking-tight"
                : "opacity-0 -translate-x-2 pointer-events-none",
            )}
          >
            P
          </span>
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Collapse sidebar"
          >
            <SidebarSimple
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
            onClick={() => setCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Expand sidebar"
          >
            <SidebarSimple
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
                      "overflow-hidden transition-all duration-150 ease-in-out",
                      collapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-3",
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
      {/* User */}
      <div
        className={cn(
          "border-t border-neutral-200 dark:border-neutral-800 py-6",
          collapsed ? "px-3" : "px-5",
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
              "h-10 w-10 shrink-0 rounded-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
              collapsed ? "mx-auto" : "",
            )}
          />

          {/* User info */}
          <div
            className={cn(
              "flex-1 overflow-hidden space-y-1 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
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
          <CaretDown
            className={cn(
              "h-4 w-4 text-neutral-500 transition-opacity duration-150",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          />
        </div>
      </div>
    </aside>
  );
}
