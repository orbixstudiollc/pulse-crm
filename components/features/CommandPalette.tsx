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

type CommandType = "action" | "nav";

interface CommandItem {
  id: string;
  name: string;
  meta: string;
  icon: React.ReactNode;
  type: CommandType;
  section: "Quick Actions" | "Navigation";
  keywords?: string[];
  href?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const iconStyles: Record<CommandType, string> = {
  action:
    "bg-muted text-fg-secondary",
  nav: "bg-muted text-fg-secondary",
};

const commands: CommandItem[] = [
  // Quick Actions
  {
    id: "add-lead",
    name: "Add New Lead",
    meta: "Create a new lead record",
    icon: <PlusIcon size={16} />,
    type: "action",
    section: "Quick Actions",
    href: "/dashboard/leads",
    keywords: ["create", "new", "add"],
  },
  {
    id: "add-deal",
    name: "Add New Deal",
    meta: "Create a new deal record",
    icon: <PlusIcon size={16} />,
    type: "action",
    section: "Quick Actions",
    href: "/dashboard/sales",
    keywords: ["create", "new", "add"],
  },
  {
    id: "export",
    name: "Export Report",
    meta: "Download data as CSV or PDF",
    icon: <ExportIcon size={16} />,
    type: "action",
    section: "Quick Actions",
    href: "/dashboard/analytics",
    keywords: ["download", "csv", "pdf"],
  },
  {
    id: "settings",
    name: "Go to Settings",
    meta: "Manage your preferences",
    icon: <GearIcon size={16} />,
    type: "action",
    section: "Quick Actions",
    href: "/dashboard/settings",
  },

  // Navigation
  {
    id: "nav-overview",
    name: "Overview",
    meta: "Dashboard overview",
    icon: <GaugeIcon size={16} />,
    type: "nav",
    section: "Navigation",
    href: "/dashboard/overview",
  },
  {
    id: "nav-customers",
    name: "Customers",
    meta: "Manage your customers",
    icon: <UsersIcon size={16} />,
    type: "nav",
    section: "Navigation",
    href: "/dashboard/customers",
  },
  {
    id: "nav-leads",
    name: "Leads",
    meta: "Track your leads",
    icon: <FunnelIcon size={16} />,
    type: "nav",
    section: "Navigation",
    href: "/dashboard/leads",
  },
  {
    id: "nav-sales",
    name: "Sales",
    meta: "View your sales pipeline",
    icon: <CurrencyDollarIcon size={16} />,
    type: "nav",
    section: "Navigation",
    href: "/dashboard/sales",
  },
  {
    id: "nav-activity",
    name: "Activity",
    meta: "Recent activity feed",
    icon: <PulseIcon size={16} />,
    type: "nav",
    section: "Navigation",
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
      className="max-w-xl shadow-modal"
    >
      {/* Search input */}
      <div className="flex h-12 items-center gap-2.5 border-b border-divider px-4">
        <MagnifyingGlassIcon size={16} className="text-fg-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search leads, deals, contacts or type a command..."
          className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
          data-autofocus
        />
        <kbd className="shrink-0 rounded-sm bg-code px-1.5 py-0.5 text-xs text-fg-secondary">
          ESC
        </kbd>
      </div>

      {/* Results */}
      <div className="max-h-96 overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface mb-3">
              <MagnifyingGlassIcon size={16} className="text-fg-muted" />
            </div>
            <p className="text-sm font-medium text-fg mb-1">
              No results found
            </p>
            <span className="text-sm text-fg-secondary">
              Try searching for something else
            </span>
          </div>
        ) : (
          sections.map((section, sectionIndex) => (
            <div key={section} className="p-1">
              <div className="px-2.5 py-1.5 text-xs font-medium text-fg-secondary">
                {section}
              </div>

              {groupedCommands[section].map((cmd, itemIndex) => {
                const flatIndex = getFlatIndex(sectionIndex, itemIndex);
                const isActive = flatIndex === activeIndex;

                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 transition-colors",
                      isActive
                        ? "bg-muted"
                        : "hover:bg-muted",
                    )}
                  >
                    {/* Icon */}
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                        iconStyles[cmd.type],
                      )}
                    >
                      {cmd.icon}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-fg truncate">
                        {cmd.name}
                      </div>
                      <div className="text-xs text-fg-secondary truncate">
                        {cmd.meta}
                      </div>
                    </div>

                    {/* Type badge */}
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-fg-secondary capitalize">
                      {cmd.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-5 border-t border-divider bg-subtle px-4 py-2.5 text-xs text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-sm bg-code p-1">
            <ArrowUpIcon size={12} />
          </kbd>
          <kbd className="rounded-sm bg-code p-1">
            <ArrowDownIcon size={12} />
          </kbd>
          <span className="ml-1">Navigate</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-sm bg-code p-1">
            <ArrowElbowDownLeftIcon size={12} />
          </kbd>
          <span className="ml-1">Select</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-sm bg-code px-1.5 py-1">
            ESC
          </kbd>
          <span className="ml-1">Close</span>
        </span>
      </div>
    </Modal>
  );
}
