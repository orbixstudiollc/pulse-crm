"use client";

import { Suspense, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  AddressBookIcon,
  CalendarBlankIcon,
  CaretDownIcon,
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
import { SETTINGS_GROUPS, parseSettingsTab } from "./settings-nav";
import { openSearch } from "./SearchBar";

type NavItem = { name: string; href: string; icon: Icon };
type NavGroup = { label?: string; items: NavItem[]; collapsible?: boolean };

// Grouped by workflow: find people, reach them, manage the relationship.
// Rarely used tools sit in a collapsed "More" group so the main list fits on one screen.
const navigationGroups: NavGroup[] = [
  {
    items: [
      { name: "Copilot", href: "/dashboard/copilot", icon: RobotIcon },
      { name: "Overview", href: "/dashboard/overview", icon: GaugeIcon },
      { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon },
    ],
  },
  {
    label: "Prospect",
    items: [
      { name: "Leads", href: "/dashboard/leads", icon: FunnelIcon },
      { name: "Lead Finder", href: "/dashboard/lead-finder", icon: MagnifyingGlassIcon },
      { name: "Website Visitors", href: "/dashboard/website-visitors", icon: CursorClickIcon },
      { name: "ICP", href: "/dashboard/icp", icon: CrosshairIcon },
    ],
  },
  {
    label: "Outreach",
    items: [
      { name: "Inbox", href: "/dashboard/inbox", icon: TrayIcon },
      { name: "Campaigns", href: "/dashboard/campaigns", icon: PaperPlaneTiltIcon },
      { name: "Sequences", href: "/dashboard/sequences", icon: EnvelopeIcon },
      { name: "Templates", href: "/dashboard/templates", icon: NoteIcon },
    ],
  },
  {
    label: "CRM",
    items: [
      { name: "Customers", href: "/dashboard/customers", icon: UsersIcon },
      { name: "Contacts", href: "/dashboard/contacts", icon: AddressBookIcon },
      { name: "Sales", href: "/dashboard/sales", icon: CurrencyDollarIcon },
      { name: "Activity", href: "/dashboard/activity", icon: PulseIcon },
      { name: "Calendar", href: "/dashboard/calendar", icon: CalendarBlankIcon },
    ],
  },
  {
    label: "More",
    collapsible: true,
    items: [
      { name: "Proposals", href: "/dashboard/proposals", icon: ScrollIcon },
      { name: "Playbook", href: "/dashboard/playbook", icon: FileTextIcon },
      { name: "Competitors", href: "/dashboard/competitors", icon: ShieldIcon },
      { name: "Marketing", href: "/dashboard/marketing", icon: MegaphoneSimpleIcon },
    ],
  },
];

const bottomNavigation: NavItem[] = [
  { name: "Settings", href: "/dashboard/settings", icon: GearIcon },
];

const SETTINGS_PATH = "/dashboard/settings";

// Twenty-style nav row: 28px, rounded, a soft grey fill on hover and when active.
const navItemClass =
  "relative mx-2 flex h-7 items-center gap-2 rounded-sm px-2 text-[13px] text-fg-secondary transition-colors duration-150 hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.06]";
const navItemActiveClass = "bg-black/[0.06] font-medium text-fg dark:bg-white/[0.08]";

// ── Shared sidebar content ──────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: ItemIcon,
  isActive,
  onNavClick,
  shallow,
  className,
}: {
  href: string;
  label: string;
  icon: Icon;
  isActive: boolean;
  onNavClick?: () => void;
  /** Update the URL via the History API (no server round trip) on a plain left click. */
  shallow?: boolean;
  className?: string;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (shallow && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      window.history.pushState(null, "", href);
    }
    onNavClick?.();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(navItemClass, isActive && navItemActiveClass, className)}
    >
      <ItemIcon
        size={16}
        className={cn("shrink-0", isActive ? "text-fg" : "text-fg-secondary")}
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

const groupLabelClass = "px-4 pt-1 pb-1 text-[11px] font-semibold text-fg-muted";

function NavGroupSection({
  group,
  pathname,
  onNavClick,
}: {
  group: NavGroup;
  pathname: string;
  onNavClick?: () => void;
}) {
  const hasActive = group.items.some((item) => pathname.startsWith(item.href));
  const [toggled, setToggled] = useState(false);
  // The group with the current page always stays open.
  const isOpen = !group.collapsible || hasActive || toggled;
  const listId = `nav-group-${group.label?.toLowerCase()}`;

  return (
    <>
      {group.collapsible ? (
        <button
          type="button"
          onClick={() => setToggled((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={listId}
          disabled={hasActive}
          className={cn(groupLabelClass, "flex w-full items-center gap-1 text-left hover:text-fg disabled:hover:text-fg-muted")}
        >
          {group.label}
          <CaretDownIcon
            size={10}
            className={cn("transition-transform duration-150", !isOpen && "-rotate-90")}
          />
        </button>
      ) : (
        group.label && <p className={groupLabelClass}>{group.label}</p>
      )}
      {isOpen && (
        <div id={listId}>
          <NavList items={group.items} pathname={pathname} onNavClick={onNavClick} />
        </div>
      )}
    </>
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
        className={cn(navItemClass, "mt-1")}
      >
        <CaretLeftIcon size={14} className="shrink-0" />
        Back to app
      </Link>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label}>
          <p className={cn(groupLabelClass, "pt-4")}>{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={`${SETTINGS_PATH}?tab=${item.id}`}
                  label={item.label}
                  icon={item.icon}
                  isActive={activeTab === item.id}
                  onNavClick={onNavClick}
                  shallow
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
  const activeTab = parseSettingsTab(useSearchParams().get("tab"));
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
      <nav className="flex-1 overflow-y-auto pb-2">
        <button
          type="button"
          onClick={() => {
            onNavClick?.();
            openSearch();
          }}
          className={cn(navItemClass, "w-[calc(100%-1rem)] text-left")}
        >
          <MagnifyingGlassIcon size={16} className="shrink-0 text-fg-secondary" />
          <span className="truncate">Search</span>
          <kbd className="ml-auto font-sans text-[11px] text-fg-muted">⌘K</kbd>
        </button>
        {navigationGroups.map((group) => (
          <div key={group.label ?? "main"} className={group.label ? "pt-3" : "pt-1"}>
            <NavGroupSection group={group} pathname={pathname} onNavClick={onNavClick} />
          </div>
        ))}
      </nav>

      {/* Bottom group: pinned to the sidebar bottom */}
      <div className="mt-auto shrink-0 py-2">
        <NavList items={bottomNavigation} pathname={pathname} onNavClick={onNavClick} />
      </div>
    </>
  );
}

// ── Desktop Sidebar (inline) ────────────────────────────────────────────────

function WorkspaceRow({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <Link
      href="/dashboard/overview"
      onClick={onNavClick}
      className={cn(navItemClass, "h-8 text-fg")}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent text-[11px] font-semibold text-white">
        P
      </span>
      <span className="truncate font-medium">Pulse</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-app">
      <div className="flex h-12 shrink-0 items-center">
        <div className="w-full">
          <WorkspaceRow />
        </div>
      </div>
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
            className="fixed left-0 top-0 h-full w-[240px] border-r border-line bg-app z-50 flex flex-col lg:hidden"
          >
            {/* Workspace row: the top bar sits behind the overlay */}
            <div className="flex h-12 shrink-0 items-center pr-2">
              <div className="min-w-0 flex-1">
                <WorkspaceRow onNavClick={closeMobile} />
              </div>
              <button type="button" onClick={closeMobile} aria-label="Close menu" className="flex h-7 w-7 items-center justify-center rounded-sm text-fg-secondary hover:bg-black/[0.04] hover:text-fg"><XIcon size={16} /></button>
            </div>
            <SidebarContent onNavClick={closeMobile} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
