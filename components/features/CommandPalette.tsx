"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import {
  MagnifyingGlassIcon,
  UsersIcon,
  FunnelIcon,
  GaugeIcon,
  GearIcon,
  PlusIcon,
  CurrencyDollarIcon,
  PulseIcon,
  ExportIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowElbowDownLeftIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type CommandType = "lead" | "deal" | "contact" | "action" | "nav";

interface CommandItem {
  id: string;
  name: string;
  meta: string;
  icon: React.ReactNode;
  type: CommandType;
  section: "Recent" | "Quick Actions" | "Navigation";
  shortcut?: string;
  keywords?: string[];
  href?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const iconStyles: Record<CommandType, string> = {
  lead: "border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 dark:bg-green-400/15 text-green-600 dark:text-green-400",
  deal: "border-[0.5px] border-blue-100 dark:border-blue-400/30 bg-blue-100 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400",
  contact:
    "border-[0.5px] border-purple-200 dark:border-purple-400/30 bg-purple-100 dark:bg-purple-400/15 text-purple-600 dark:text-purple-400",
  action:
    "border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 text-neutral-600 dark:text-neutral-400",
  nav: "border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 text-neutral-600 dark:text-neutral-400",
};

const commands: CommandItem[] = [
  // Recent
  {
    id: "recent-lead-1",
    name: "Maria Santos",
    meta: "Lead · Hot · Added 10 hours ago",
    icon: <FunnelIcon size={18} />,
    type: "lead",
    section: "Recent",
    href: "/dashboard/leads/1",
  },
  {
    id: "recent-deal-1",
    name: "Acme Corp - Enterprise",
    meta: "Deal · $24,500 · Closed Won",
    icon: <CurrencyDollarIcon size={18} />,
    type: "deal",
    section: "Recent",
    href: "/dashboard/sales/1",
  },
  {
    id: "recent-contact-1",
    name: "James Wilson",
    meta: "Contact · Acme Corp · CEO",
    icon: <UsersIcon size={18} />,
    type: "contact",
    section: "Recent",
    href: "/dashboard/customers/1",
  },

  // Quick Actions
  {
    id: "add-lead",
    name: "Add New Lead",
    meta: "Create a new lead record",
    icon: <PlusIcon size={18} />,
    type: "action",
    section: "Quick Actions",
    shortcut: "⌘ L",
    keywords: ["create", "new", "add"],
  },
  {
    id: "add-deal",
    name: "Add New Deal",
    meta: "Create a new deal record",
    icon: <PlusIcon size={18} />,
    type: "action",
    section: "Quick Actions",
    shortcut: "⌘ D",
    keywords: ["create", "new", "add"],
  },
  {
    id: "export",
    name: "Export Report",
    meta: "Download data as CSV or PDF",
    icon: <ExportIcon size={18} />,
    type: "action",
    section: "Quick Actions",
    shortcut: "⌘ E",
    keywords: ["download", "csv", "pdf"],
  },
  {
    id: "settings",
    name: "Go to Settings",
    meta: "Manage your preferences",
    icon: <GearIcon size={18} />,
    type: "action",
    section: "Quick Actions",
    shortcut: "⌘ ,",
    href: "/dashboard/settings",
  },

  // Navigation
  {
    id: "nav-overview",
    name: "Overview",
    meta: "Dashboard overview",
    icon: <GaugeIcon size={18} />,
    type: "nav",
    section: "Navigation",
    shortcut: "G O",
    href: "/dashboard/overview",
  },
  {
    id: "nav-customers",
    name: "Customers",
    meta: "Manage your customers",
    icon: <UsersIcon size={18} />,
    type: "nav",
    section: "Navigation",
    shortcut: "G C",
    href: "/dashboard/customers",
  },
  {
    id: "nav-leads",
    name: "Leads",
    meta: "Track your leads",
    icon: <FunnelIcon size={18} />,
    type: "nav",
    section: "Navigation",
    shortcut: "G L",
    href: "/dashboard/leads",
  },
  {
    id: "nav-sales",
    name: "Sales",
    meta: "View your sales pipeline",
    icon: <CurrencyDollarIcon size={18} />,
    type: "nav",
    section: "Navigation",
    shortcut: "G S",
    href: "/dashboard/sales",
  },
  {
    id: "nav-activity",
    name: "Activity",
    meta: "Recent activity feed",
    icon: <PulseIcon size={18} />,
    type: "nav",
    section: "Navigation",
    shortcut: "G A",
    href: "/dashboard/activity",
  },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const matchName = cmd.name.toLowerCase().includes(lowerQuery);
      const matchMeta = cmd.meta.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some((k) => k.includes(lowerQuery));
      return matchName || matchMeta || matchKeywords;
    });
  }, [query]);

  // Group by section
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.section]) groups[cmd.section] = [];
      groups[cmd.section].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const sections = Object.keys(groupedCommands);

  // Execute command
  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      if (cmd.href) {
        router.push(cmd.href);
      } else if (cmd.action) {
        cmd.action();
      }
      onClose();
      setQuery("");
      setActiveIndex(0);
    },
    [router, onClose],
  );

  // Handle query change - reset active index
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActiveIndex(0);
  };

  // Handle close with reset
  const handleClose = useCallback(() => {
    onClose();
    setQuery("");
    setActiveIndex(0);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i < filteredCommands.length - 1 ? i + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i > 0 ? i - 1 : filteredCommands.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[activeIndex]) {
            executeCommand(filteredCommands[activeIndex]);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, activeIndex, filteredCommands, executeCommand]);

  // Get flat index for an item
  const getFlatIndex = (sectionIndex: number, itemIndex: number) => {
    let index = 0;
    for (let i = 0; i < sectionIndex; i++) {
      index += groupedCommands[sections[i]].length;
    }
    return index + itemIndex;
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      position="top"
      className="max-w-xl"
    >
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4">
        <MagnifyingGlassIcon size={20} className="text-neutral-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search leads, deals, contacts or type a command..."
          className="flex-1 bg-transparent text-base text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none"
          autoFocus
        />
        <kbd className="shrink-0 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400">
          ESC
        </kbd>
      </div>

      {/* Results */}
      <div className="max-h-96 overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mb-3">
              <MagnifyingGlassIcon
                size={20}
                className="text-neutral-400 dark:text-neutral-500"
              />
            </div>
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1">
              No results found
            </p>
            <span className="text-sm text-neutral-500">
              Try searching for something else
            </span>
          </div>
        ) : (
          sections.map((section, sectionIndex) => (
            <div key={section} className="py-2">
              <div className="px-5 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {section}
              </div>

              {groupedCommands[section].map((cmd, itemIndex) => {
                const flatIndex = getFlatIndex(sectionIndex, itemIndex);
                const isActive = flatIndex === activeIndex;
                const isLast =
                  itemIndex === groupedCommands[section].length - 1;

                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3 transition-colors",
                      isActive
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                      !isLast &&
                        "border-b-[0.5px] border-neutral-100 dark:border-neutral-800",
                    )}
                  >
                    {/* Icon */}
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded shrink-0",
                        iconStyles[cmd.type],
                      )}
                    >
                      {cmd.icon}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                        {cmd.name}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {cmd.meta}
                      </div>
                    </div>

                    {/* Shortcut or Type badge */}
                    {cmd.shortcut ? (
                      <kbd className="shrink-0 rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        {cmd.shortcut}
                      </kbd>
                    ) : (
                      <span className="shrink-0 rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                        {cmd.type}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-5 py-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
            <ArrowUpIcon size={12} />
          </kbd>
          <kbd className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
            <ArrowDownIcon size={12} />
          </kbd>
          <span className="ml-1">Navigate</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
            <ArrowElbowDownLeftIcon size={12} />
          </kbd>
          <span className="ml-1">Select</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-1.5 py-1">
            ESC
          </kbd>
          <span className="ml-1">Close</span>
        </span>
      </div>
    </Modal>
  );
}
