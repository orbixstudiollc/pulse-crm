"use client";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SquaresFour,
  Users,
  Funnel,
  CurrencyDollar,
  Activity,
  Gear,
  CaretDown,
  SidebarSimple,
} from "phosphor-react";

const navigation = [
  { name: "Overview", href: "/dashboard/overview", icon: SquaresFour },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Leads", href: "/dashboard/leads", icon: Funnel },
  { name: "Sales", href: "/dashboard/sales", icon: CurrencyDollar },
  { name: "Activity", href: "/dashboard/activity", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Gear },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex w-60 flex-col border-r bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
      {/* Logo */}
      <div className="flex items-center justify-between gap-3 px-5 py-6">
        <span className="font-serif text-4xl italic text-neutral-950 dark:text-neutral-50">
          Pulse
        </span>
        <SidebarSimple
          weight="regular"
          size={20}
          className="text-neutral-600 dark:text-neutral-400"
        />
      </div>

      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        Toggle theme
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-5 py-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
                  )}
                >
                  <item.icon className="h-5 w-5" weight="regular" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Upgrade Card */}
      <div className="mx-3 mb-4 rounded-lg bg-neutral-200 dark:bg-neutral-800 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Leads</span>
          <span className="text-neutral-600 dark:text-neutral-400">
            847 / 2000
          </span>
        </div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-green-500"
            style={{ width: "42%" }}
          />
        </div>
        <button className="w-full rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 px-4 py-2.5 text-sm font-medium">
          Upgrade to Unlimited
        </button>
      </div>

      {/* User */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="flex-1">
            <div className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              Angel Uriostegui
            </div>
            <div className="text-xs text-neutral-400 dark:text-neutral-500">
              Pro Plan
            </div>
          </div>
          <CaretDown className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
        </div>
      </div>
    </aside>
  );
}
