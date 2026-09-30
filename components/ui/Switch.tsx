"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  className,
}: SwitchProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
          checked
            ? "bg-accent"
            : "bg-active",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-current text-white ring-0 transition-transform duration-150 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label className="text-sm font-medium text-fg">
              {label}
            </label>
          )}
          {description && (
            <p className="text-[13px] text-fg-muted">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
