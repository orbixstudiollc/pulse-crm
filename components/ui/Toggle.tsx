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
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page",
        enabled
          ? "bg-accent"
          : "bg-fg-disabled",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-current text-white ring-0 transition-transform duration-150 ease-in-out",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
