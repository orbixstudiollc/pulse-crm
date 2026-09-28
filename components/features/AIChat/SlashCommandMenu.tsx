"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type SlashCommand,
  filterSlashCommands,
} from "@/lib/ai/slash-commands";
import {
  ChartBarIcon,
  CrosshairIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  SparkleIcon,
  ShieldIcon,
} from "@/components/ui/Icons";
import type { Icon } from "@phosphor-icons/react";

const iconMap: Record<string, Icon> = {
  ChartBar: ChartBarIcon,
  ChartLineUp: ChartBarIcon,
  Lightbulb: SparkleIcon,
  Target: CrosshairIcon,
  MagnifyingGlass: MagnifyingGlassIcon,
  Envelope: EnvelopeIcon,
  Megaphone: EnvelopeIcon,
  ShieldCheck: ShieldIcon,
};

interface SlashCommandMenuProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  query,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const commands = filterSlashCommands(query);

  // Reset selection when the query changes (adjusted during render, not in an effect)
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % commands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
      } else if (e.key === "Enter" && commands.length > 0) {
        e.preventDefault();
        onSelect(commands[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commands, selectedIndex, onSelect, onClose]);

  if (commands.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 right-0 mb-2 max-h-[240px] overflow-y-auto rounded-lg border border-line bg-surface shadow-dropdown z-50"
      >
        <div className="p-1">
          {commands.map((cmd, i) => {
            const IconComp = iconMap[cmd.icon] || SparkleIcon;
            return (
              <button
                key={cmd.id}
                onClick={() => onSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors ${
                  i === selectedIndex
                    ? "bg-muted"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <IconComp
                    size={14}
                    className="text-fg-secondary"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">
                    {cmd.label}
                  </p>
                  <p className="text-xs text-fg-secondary truncate">
                    {cmd.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
