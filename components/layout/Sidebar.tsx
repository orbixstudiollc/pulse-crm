"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  AddressBookIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
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
import { SETTINGS_GROUPS } from "./settings-nav";

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

const SETTINGS_PATH = "/dashboard/settings";

// ── Shared sidebar content ──────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: ItemIcon,
  isActive,
  onNavClick,
  className,
}: {
  href: string;
  label: string;
  icon: Icon;
  isActive: boolean;
  onNavClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 px-6 text-[14px] text-fg transition-colors duration-150 hover:bg-subtle",
        isActive && "font-medium",
        className,
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />
      )}
      <ItemIcon
        size={16}
        weight={isActive ? "fill" : "regular"}
        className={cn("shrink-0", isActive ? "text-fg" : "text-fg-muted")}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

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
            <NavLink
              href={item.href}
              label={item.name}
              icon={item.icon}
              isActive={isActive}
              onNavClick={onNavClick}
            />
          </li>
        );
      })}
    </ul>
  );
}

// ── Settings nav: replaces the app nav on /dashboard/settings ────────────────

function SettingsNavList({
  activeTab,
  onNavClick,
}: {
  activeTab: string | null;
  onNavClick?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto pb-2">
      <Link
        href="/dashboard/overview"
        onClick={onNavClick}
        className="flex h-11 items-center gap-2 border-b border-divider px-6 text-[14px] text-fg-secondary transition-colors duration-150 hover:text-fg"
      >
        <CaretLeftIcon size={14} className="shrink-0" />
        Back to app
      </Link>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-6 pt-4 pb-1 text-[13px] text-fg-muted">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={`${SETTINGS_PATH}?tab=${item.id}`}
                  label={item.label}
                  icon={item.icon}
                  isActive={activeTab === item.id}
                  onNavClick={onNavClick}
                  className="hover:bg-muted"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ActiveSettingsNav({ onNavClick }: { onNavClick?: () => void }) {
  const activeTab = useSearchParams().get("tab") || "profile";
  return <SettingsNavList activeTab={activeTab} onNavClick={onNavClick} />;
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  if (pathname.startsWith(SETTINGS_PATH)) {
    // useSearchParams needs a Suspense boundary when a route renders statically.
    return (
      <Suspense fallback={<SettingsNavList activeTab={null} onNavClick={onNavClick} />}>
        <ActiveSettingsNav onNavClick={onNavClick} />
      </Suspense>
    );
  }

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
  const isSettings = usePathname().startsWith(SETTINGS_PATH);
  return (
    <aside
      className={cn(
        "hidden lg:flex w-[240px] shrink-0 flex-col border-r border-divider",
        isSettings ? "bg-subtle" : "bg-surface",
      )}
    >
      <SidebarContent />
    </aside>
  );
}

// ── Mobile Sidebar (overlay drawer) ─────────────────────────────────────────

export function MobileSidebar() {
  const { mobileOpen, closeMobile } = useSidebar();
  const pathname = usePathname();
  const isSettings = pathname.startsWith(SETTINGS_PATH);

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
            className={cn(
              "fixed left-0 top-0 h-full w-[240px] border-r border-divider z-50 flex flex-col lg:hidden",
              isSettings ? "bg-subtle" : "bg-surface",
            )}
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
