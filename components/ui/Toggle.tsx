"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  enabled,
  onChange,
  disabled,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:focus:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa]",
        enabled
          ? "bg-neutral-950 dark:bg-neutral-50"
          : "bg-neutral-200 dark:bg-neutral-700",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white dark:bg-neutral-950 shadow-sm ring-0 transition-transform duration-200 ease-in-out",
          enabled ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
