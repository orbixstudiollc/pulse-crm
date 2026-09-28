"use client";

import { cn } from "@/lib/utils";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  className,
}: RadioGroupProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-fg mb-2">
          {label}
        </label>
      )}
      <div className="flex gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
              value === option.value
                ? "border-accent bg-accent-surface"
                : "border-line hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 shrink-0 rounded-full border bg-surface flex items-center justify-center transition-colors",
                value === option.value
                  ? "border-accent"
                  : "border-line",
              )}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-accent" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-fg">
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-fg-secondary">
                  {option.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
