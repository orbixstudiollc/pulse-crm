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
              "relative flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30",
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
                  ? "border-accent bg-accent"
                  : "border-line",
              )}
            >
              {value === option.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-current text-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-fg">
                {option.label}
              </p>
              {option.description && (
                <p className="text-[13px] text-fg-muted">
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
