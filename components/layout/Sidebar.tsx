"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  AddressBookIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  CrosshairIcon,
  CursorClickIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  TrayIcon,
  FileTextIcon,
  FunnelIcon,
  GaugeIcon,
  GearIcon,
  MagnifyingGlassIcon,
  MegaphoneSimpleIcon,
  NoteIcon,
  PaperPlaneTiltIcon,
  PulseIcon,
  RobotIcon,
  ScrollIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from "../ui";
import { useSidebar } from "./SidebarContext";

type NavItem = { name: string; href: string; icon: Icon };

// Groups keep the original item order; Clay separates them with hairlines.
const navigationGroups: NavItem[][] = [
  [
    { name: "Copilot", href: "/dashboard/copilot", icon: RobotIcon },
    { name: "Overview", href: "/dashboard/overview", icon: GaugeIcon },
  ],
  [
    { name: "Customers", href: "/dashboard/customers", icon: UsersIcon },
    { name: "Leads", href: "/dashboard/leads", icon: FunnelIcon },
    { name: "Lead Finder", href: "/dashboard/lead-finder", icon: MagnifyingGlassIcon },
    { name: "Website Visitors", href: "/dashboard/website-visitors", icon: CursorClickIcon },
    { name: "ICP", href: "/dashboard/icp", icon: CrosshairIcon },
  ],
  [
    { name: "Campaigns", href: "/dashboard/campaigns", icon: PaperPlaneTiltIcon },
    { name: "Sequences", href: "/dashboard/sequences", icon: EnvelopeIcon },
    { name: "Templates", href: "/dashboard/templates", icon: NoteIcon },
    { name: "Inbox", href: "/dashboard/inbox", icon: TrayIcon },
  ],
  [
    { name: "Contacts", href: "/dashboard/contacts", icon: AddressBookIcon },
    { name: "Sales", href: "/dashboard/sales", icon: CurrencyDollarIcon },
    { name: "Activity", href: "/dashboard/activity", icon: PulseIcon },
    { name: "Calendar", href: "/dashboard/calendar", icon: CalendarBlankIcon },
    { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon },
  ],
  [
    { name: "Proposals", href: "/dashboard/proposals", icon: ScrollIcon },
    { name: "Playbook", href: "/dashboard/playbook", icon: FileTextIcon },
    { name: "Competitors", href: "/dashboard/competitors", icon: ShieldIcon },
    { name: "Marketing", href: "/dashboard/marketing", icon: MegaphoneSimpleIcon },
  ],
];

const bottomNavigation: NavItem[] = [
  { name: "Settings", href: "/dashboard/settings", icon: GearIcon },
];

// ── Shared sidebar content ──────────────────────────────────────────────────

function NavList({
  items,
  pathname,
  onNavClick,
}: {
  items: NavItem[];
  pathname: string;
  onNavClick?: () => void;
}) {
  return (
    <ul>
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 px-6 text-[14px] text-fg transition-colors duration-150 hover:bg-subtle",
                isActive && "font-medium",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />
              )}
              <item.icon
                size={16}
                weight={isActive ? "fill" : "regular"}
                className={cn("shrink-0", isActive ? "text-fg" : "text-fg-muted")}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {navigationGroups.map((group, index) => (
          <div
            key={group[0].href}
            className={cn("py-2", index > 0 && "border-t border-divider")}
          >
            <NavList items={group} pathname={pathname} onNavClick={onNavClick} />
          </div>
        ))}
      </nav>

      {/* Bottom group: pinned to the sidebar bottom */}
      <div className="mt-auto shrink-0 border-t border-divider py-2">
        <NavList items={bottomNavigation} pathname={pathname} onNavClick={onNavClick} />
      </div>
    </>
  );
}

// ── Desktop Sidebar (inline) ────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-surface border-r border-divider">
      <SidebarContent />
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
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-0 top-0 h-full w-[240px] bg-surface border-r border-divider z-50 flex flex-col lg:hidden"
          >
            {/* Wordmark row: the top bar sits behind the overlay */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-divider px-6">
              <Link
                href="/dashboard/overview"
                className="text-[18px] font-semibold text-fg"
                onClick={closeMobile}
              >
                Pulse
              </Link>
              <button type="button" onClick={closeMobile} aria-label="Close menu" className="-mr-3 flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-subtle hover:text-fg"><XIcon size={16} /></button>
            </div>
            <SidebarContent onNavClick={closeMobile} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
